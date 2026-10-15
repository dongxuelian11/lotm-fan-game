import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const REAPER_ENCOUNTER_STORY = '完成至少一项真实和平报告后，可实际前往原练习场独立空石院。成年普通挡路者维克RE5-VICK因出入误会在2米外持自己唯一的普通原短棍RE5-VICK-CLUB抵抗；原石院净空，无旁人或可燃物，彼此可见，当前持棍重心与暴露空当可实际观察。身后原后门净空可退出，不是追逐，也不会拖带人物物件。可普通交涉或承担真实战斗风险；观察并不赠送攻击，短窗口内的有限精准打击仍不保证命中、致死或穿透全部防护，对手照常行动。猎人可在这条原空通路制造自身火焰；没有火焰跳跃、纸人替身或铁血骑士军团。现场、窗口时限与全部数值是本作原创G。';

export function hasReaperOpenPractice(s: SliceState): boolean {
  return Object.values(s.reaper.cases).some(r => r.contactOpen || r.status === 'PREPARED' || r.practice.windowOpen);
}
export function blockReaperEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 5) return '先成为收割者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原练习场石院。';
  if (hasReaperOpenPractice(s) || Object.values(s.conspirator.cases).some(r => r.contactOpen || r.status === 'PREPARED')) {
    return '先实际结束当前接触、准备或练习窗口，再去原石院。';
  }
  if (!Object.values(s.reaper.cases).some(r => r.status === 'RESOLVED')) return '先完成一项收割者和平实践与真实报告。';
  if (s.reaper.encounter.status !== 'AVAILABLE') return '本段石院争议已有结果，不能再生成维克或重刷结果。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.reaper.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyReaperEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockReaperEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.reaper.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原空石院', '花费1行动到达原空石院。成年普通人维克在2米外持自己的原普通短棍；身后实际后门可退出，没有带来新物品、弱点窗口或免费攻击。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('维克自行让开原通路', '维克听取实际报告和普通澄清后自行让路，仍然活着并持有自己的原棍。没有强迫服从，没有额外扮演或掌握奖励。');
    } else ctx.note('维克仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可以离开，下一真实周再普通交涉，或选择真实战斗。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  e.weakness = { sourceRound: null, available: false, observations: 0, uses: 0 };
  s.combat = { encounterId: 'REAPER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原空石院的有限冲突', REAPER_ENCOUNTER_STORY);
}
/** Same actual resisting person and the complete current round history, never
 * an old practice dummy, first-case person or second copy of the opponent. */
export function hasReaperDisputeOpponent(s: SliceState): boolean {
  const e = s.reaper?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'REAPER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasReaperOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 ||
      !Object.values(s.reaper.cases).some(r => r.status === 'RESOLVED')) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleReaperEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.reaper.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'REAPER_DISPUTE') throw new Error('没有正在进行的收割者原石院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知收割者原石院冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound ||
      s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      s.combatHistory.at(-1)?.round !== c.lastRound.round ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER')) ||
      (outcome === 'RETREATED' && c.lastRound.retreat !== 'SUCCESS') ||
      (outcome === 'PLAYER_DEAD' && s.health !== 0)) throw new Error('结局与原回合或身体结果不一致，不能制造投降、改写死亡或发放奖励。');
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  e.weakness.available = false; e.weakness.sourceRound = null;
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('reaper-dispute', 25);
  s.combat = null;
  ctx.note('原石院真实冲突结束', e.status === 'LOST' ? '玩家真实死亡已经结算，没有复活或奖励；原结果保留。'
    : e.status === 'RETREATED' ? '你沿原后门实际退出，没有瞬移、追逐、拖带维克或拿走他的原棍；双方原伤势、消耗与已过期窗口保留，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '维克在原战斗中真实死亡，原尸体与自己的原棍留在石院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '维克仍活着，自行停止抵抗并放下自己的原普通短棍。原棍归属不变，弱点观察和火焰没有强迫投降；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateReaperEncounter(s: SliceState): boolean {
  const e = s.reaper.encounter, w = e.weakness, c = s.combat;
  if (!Number.isSafeInteger(w.observations) || w.observations < 0 || !Number.isSafeInteger(w.uses) ||
      w.uses < 0 || w.uses > w.observations || typeof w.available !== 'boolean' ||
      (w.available ? !Number.isSafeInteger(w.sourceRound) || w.sourceRound === null || w.sourceRound < 1 || w.observations <= w.uses : w.sourceRound !== null)) return false;
  if (e.status === 'FIGHTING') return hasReaperDisputeOpponent(s) &&
    (!w.available || (w.sourceRound! <= c!.round && c!.round <= w.sourceRound! + 1));
  if (c?.encounterId === 'REAPER_DISPUTE' || w.available || w.sourceRound !== null) return false;
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RESOLVED'].includes(e.status) && w.observations === 0 && w.uses === 0;
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length ||
      e.attemptWeek === null || e.attemptWeek > s.week) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex);
  // A subsequent unrelated encounter starts again at round1. Only this first
  // contiguous encounter segment belongs to Vick's retained result.
  const next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS'))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}
