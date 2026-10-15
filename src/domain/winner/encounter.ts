import type { SliceCombatRound, SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const WINNER_ENCOUNTER_STORY = '完成至少一项真实报告并收束原计数片、原环和原便笺后，可花1行动沿原通路到报时铺指导室独立日光净空外院。本作原创成年普通人奥德里因场地预约误会持自己的原普通短棍在2米外抵抗；不是杜兰或旧对手。双方实际可见，原地面净空，没有旁人、松动物或可用灾源；身后原普通出口畅通，没有追逐。可普通澄清、实际沿原出口撤退，或承担共同伤势与死亡风险。有限好运和厄运使用本人已实际积累的有限积运；默认保留，每轮仅第一个合格B/K可选择耗1积运与2灵性。好运并非必中、必胜或无伤，厄运失败也付费，不能重抽、改写已发生结果或挪用原物。人物、现场、容量与效果均为本作G。';
function practiceClosed(s: SliceState): boolean {
  const p = s.winner.practice, old = s.calamityPriest.practice;
  return p.counter === 'GUIDE' && p.ring === 'OWNER' && p.note !== 'WRITTEN' &&
    Object.values(s.winner.cases).every(r => !r.contactOpen && r.status !== 'PREPARED') &&
    ['UNASSESSED', 'SECURED'].includes(old.hazard) && ['RESTING', 'SECURED'].includes(old.board) &&
    ['NONE', 'RELEASED'].includes(old.contact) &&
    Object.values(s.calamityPriest.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.winner.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
export function blockWinnerEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'wheel' || s.progression.sequence !== 5) return '先成为命运之轮途径的赢家。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原报时铺指导室外院。';
  if (!practiceClosed(s) || s.winner.encounter.staggerReady) return '先实际归还原计数片、原环、原便笺并结束全部接触或准备。';
  if (!reportsComplete(s)) return '先完成至少一项赢家真实实践与报告。';
  if (s.winner.encounter.status !== 'AVAILABLE') return '奥德里本次原外院争议已有结果，不能重复开启或重新生成原敌。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.winner.encounter.attemptWeek === s.week
    ? '本周已经交涉，奥德里本人的拒绝保留；下一真实周可以再普通澄清。' : null;
}
export function applyWinnerEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockWinnerEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.winner.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原报时铺独立日光外院', '花费1行动沿原通路到达。成年普通人奥德里持自己的原普通短棍在2米外，双方实际可见，原地面净空、没有旁人，原出口可退出；没有移动奥德里或他的原棍。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('奥德里自行让开原通路', '奥德里听取真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有控制意愿、消耗或补充积运，也没有额外扮演或掌握奖励。');
    } else ctx.note('奥德里仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留；可以离开、下一真实周再普通澄清，或承担实际战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length; e.lastLuckRound = null; e.staggerReady = false;
  s.combat = { encounterId: 'WINNER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('奥德里原外院的有限冲突', WINNER_ENCOUNTER_STORY);
}
export function hasWinnerDisputeOpponent(s: SliceState): boolean {
  const e = s.winner?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'wheel' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'WINNER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || !practiceClosed(s) || !reportsComplete(s) ||
      typeof e.staggerReady !== 'boolean' ||
      (e.lastLuckRound !== null && (!Number.isSafeInteger(e.lastLuckRound) || e.lastLuckRound < 1 || e.lastLuckRound > c.round)) ||
      (e.staggerReady && e.lastLuckRound !== c.round) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleWinnerEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.winner.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'WINNER_DISPUTE') throw new Error('没有正在进行的奥德里原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知赢家冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || !practiceClosed(s) || e.staggerReady ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !c.lastRound ||
      c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(c.lastRound) ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && (i === c.lastRound!.round - 1 || r.retreat !== 'SUCCESS')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS'))) {
    throw new Error('结局与原回合、原身体结果或有限厄运收束不一致，不能制造投降、死亡或奖励。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('winner-dispute')) award('winner-dispute', 25);
  s.combat = null;
  ctx.note('奥德里原外院冲突结束', e.status === 'LOST'
    ? '玩家在原外院真实死亡，原身体与各自原物留在现场；有限厄运结束，实付积运与灵性不退回，没有复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出，奥德里和自己的原短棍留在原处；没有追逐、瞬移、拖带或夺棍。有限厄运结束，剩余积运、原伤势与实际消耗保留，没有奖励。'
    : outcome === 'ENEMY_DEAD' ? '成年普通人奥德里在原外院真实死亡，原尸体与自己的原棍留在原处，不重新生成活人；死亡来自共同战盘，不是厄运必杀。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性或积运。'
    : '奥德里仍然活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变，没有强迫投降；有限厄运结束。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性或积运。');
}
function recordedLuck(s: SliceState, rounds: SliceCombatRound[]): boolean {
  let last: number | null = null, paid = 0;
  for (const r of rounds) for (const m of r.moves) {
    if (m.actor !== 'PLAYER' || !['有限好运自保：', '有限敌方厄运成功：', '有限敌方厄运失败：'].some(prefix => m.label.startsWith(prefix))) continue;
    if (last === r.round) return false;
    last = r.round; paid += 1;
  }
  return !s.winner.encounter.staggerReady && s.winner.encounter.lastLuckRound === last && paid <= s.winner.luck.spent;
}
/** Saved boundaries never carry an unresolved strike modifier or replenish luck. */
export function validateWinnerEncounter(s: SliceState): boolean {
  const e = s.winner.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'winner-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      typeof e.staggerReady !== 'boolean' || e.staggerReady ||
      (e.lastLuckRound !== null && (!Number.isSafeInteger(e.lastLuckRound) || e.lastLuckRound < 1)) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const pristine = e.lastLuckRound === null && !e.staggerReady;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && pristine;
  const promoted = s.progression.pathwayId === 'wheel' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'WINNER_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.winner.promotionWeek === null || e.attemptWeek === null || e.attemptWeek < s.winner.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasWinnerDisputeOpponent(s) && recordedLuck(s, s.combatHistory.slice(e.startHistoryIndex!));
  if (c?.encounterId === 'WINNER_DISPUTE') return false;
  if (e.startHistoryIndex === null) return pristine && (e.status === 'AVAILABLE' || (e.status === 'RESOLVED' && e.attemptWeek !== null));
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS')) || !recordedLuck(s, own)) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}
