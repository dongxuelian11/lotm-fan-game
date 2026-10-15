import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { CRIMSON_SCHOLAR_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const CRIMSON_SCHOLAR_ENCOUNTER_STORY = '全部三项实践已报告、接触已关闭、本人已回到原起点、区域月场已实际结束且无进行中的仪式后，可花1行动按实际约定在夜间前往原私人庭院。本次原露天庭院当前确有月光，成年普通来访者西德在2米外持自己的唯一原普通短棍，身体与月照下原影实际可见，原地净空无旁人。身后实际原出口可退出，没有追逐。继承黑暗之翼与深渊枷锁仅依本次原身体、原影和原空间结算；月光重组只对仍活着的自己有限恢复。区域月相与月光闪现不移入战斗，不生成隐藏物品或人物，不复制身体或西德，不夺原棍。场景、成年角色、夜间约定、有限效果与数值均为原创G。';

export function hasCrimsonScholarOpenPractice(s: SliceState): boolean {
  return Object.values(s.crimsonScholar.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' ||
    s.crimsonScholar.ritual.activeVisitId !== null ||
    Object.values(s.potionProfessor.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    Object.values(s.potionProfessor.laboratory.effects).some(Boolean);
}
function reportsComplete(s: SliceState): boolean {
  return CRIMSON_SCHOLAR_CASE_IDS.every(id => s.crimsonScholar.cases[id]?.status === 'RESOLVED' &&
    s.crimsonScholar.cases[id]!.contactOpen === false && s.crimsonScholar.cases[id]!.closes >= 1);
}
export function blockCrimsonScholarEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 5) return '先成为深红学者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原私人月照庭院。';
  if (hasCrimsonScholarOpenPractice(s)) return '先关闭全部实践与仪式，实际返回原起点并结束区域月场。';
  if (!reportsComplete(s)) return '先完成全部三项真实实践报告并关闭接触。';
  if (s.crimsonScholar.encounter.reassemblyRound !== null) return '旧轮重组记录无效，不能带入新的冲突。';
  if (s.crimsonScholar.encounter.status !== 'AVAILABLE') return '本段外院争议已有结果，不能再生成西德或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.crimsonScholar.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyCrimsonScholarEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockCrimsonScholarEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.crimsonScholar.encounter; e.attemptWeek = s.week; e.reassemblyRound = null;
  ctx.note('实际走到原私人月照庭院', '花费1行动按约定在夜间实际到达原私人庭院，本次原露天庭院当前确有月光。成年普通人西德在2米外持自己的唯一原普通短棍，身体与原影实际可见，场地净空；身后原出口可退出，没有挪走药瓶、实验物品或创造隐藏库存。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('西德自行让开原通路', '西德听取三项真实实践报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有读心、强迫服从或额外扮演与掌握奖励。');
    } else ctx.note('西德仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CRIMSON_SCHOLAR_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原私人月照庭院的有限冲突', CRIMSON_SCHOLAR_ENCOUNTER_STORY);
}
/** The original present adult, exact arrival week and current contiguous round. */
export function hasCrimsonScholarDisputeOpponent(s: SliceState): boolean {
  const e = s.crimsonScholar?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'CRIMSON_SCHOLAR_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week ||
      (e.reassemblyRound !== null && e.reassemblyRound !== c.round) || hasCrimsonScholarOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleCrimsonScholarEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.crimsonScholar.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'CRIMSON_SCHOLAR_DISPUTE') throw new Error('没有正在进行的深红学者原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知深红学者冲突结果。');
  if (e.reassemblyRound !== null) throw new Error('本轮重组标记尚未结算，不能保留至下一轮或结局。');
  if (outcome === 'CONTINUE') {
    if (!hasCrimsonScholarDisputeOpponent(s)) throw new Error('本次原庭院冲突的连续回合来源无效。');
    return;
  }
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 5 ||
      s.world.city !== 'BACKLUND' || s.activeEvent !== null || e.attemptWeek !== s.week || !reportsComplete(s) || hasCrimsonScholarOpenPractice(s) ||
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
      !s.seer.completedSources.includes('crimson-scholar-dispute')) award('crimson-scholar-dispute', 25);
  e.reassemblyRound = null;
  s.combat = null;
  ctx.note('原私人月照庭院真实冲突结束', e.status === 'LOST' ? '玩家真实死亡已经结算，月光重组没有覆写真正死亡，没有复活或奖励；原结果保留。'
    : e.status === 'RETREATED' ? '你沿实际原出口退出，没有瞬移、追逐、拖带西德或拿走他的原棍；原伤势与消耗保留，没有遗留重组效果，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '西德在原战斗中真实死亡，原尸体与自己的原棍留在外院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '西德仍活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateCrimsonScholarEncounter(s: SliceState): boolean {
  const e = s.crimsonScholar.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'crimson-scholar-dispute').length;
  if (e.reassemblyRound !== null && (e.status !== 'FIGHTING' || !c ||
      !Number.isSafeInteger(e.reassemblyRound) || e.reassemblyRound < 1 || e.reassemblyRound !== c.round)) return false;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && e.reassemblyRound === null;
  const promoted = s.progression.pathwayId === 'moon' && [5, 4, 3, 2].includes(s.progression.sequence ?? 0);
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'CRIMSON_SCHOLAR_DISPUTE';
  if (!initial && (!reportsComplete(s) || hasCrimsonScholarOpenPractice(s) ||
      s.crimsonScholar.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.crimsonScholar.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasCrimsonScholarDisputeOpponent(s);
  if (c?.encounterId === 'CRIMSON_SCHOLAR_DISPUTE') return false;
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
