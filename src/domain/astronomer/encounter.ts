import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { ASTRONOMER_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const ASTRONOMER_ENCOUNTER_STORY = '三项真实观测报告全部完成、接触关闭、原仪器归零且跨周测量已完成后，可花1行动实际前往原观测台净空外院。成年普通来访者霍伯因场地出入误会，在2米外持自己的唯一原普通短棍抵抗。身后实际原出口可退出，没有追逐；不复制本人、不拖带人物或夺走原棍。原仪器、星表和普通螺丝刀仍属于原观测台，客户的ART6-LAMP-1不借回作武器。可普通交涉或承担真实战斗风险；短时专注校准仅为本作原创G的自身有限能力，不预言真相、不读心、不发射星光或操纵天气。场景、成年角色与数值均为原创G。';

export function hasAstronomerOpenPractice(s: SliceState): boolean {
  return Object.values(s.astronomer.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    Object.values(s.artisan.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  const a = s.astronomer, p = a.practice;
  return ASTRONOMER_CASE_IDS.every(id => a.cases[id]?.status === 'RESOLVED' &&
    a.cases[id]!.contactOpen === false && a.cases[id]!.closes >= 1) &&
    p.instrumentOffset === 0 && p.measurements === 1 &&
    Number.isSafeInteger(p.calibratedWeek) && p.calibratedWeek !== null &&
    Number.isSafeInteger(p.observedWeek) && p.observedWeek !== null &&
    a.promotionWeek !== null && p.calibratedWeek >= a.promotionWeek &&
    p.observedWeek > p.calibratedWeek && p.observedWeek <= s.week;
}
export function blockAstronomerEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 5) return '先成为天文学家。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原观测台外院。';
  if (hasAstronomerOpenPractice(s)) return '先实际关闭本次观测与工房接触，再前往原外院。';
  if (!reportsComplete(s)) return '先完成全部三项真实报告，关闭接触，并完成原仪器归零后的跨周原测量。';
  if (s.astronomer.encounter.status !== 'AVAILABLE') return '本段外院争议已有结果，不能再生成霍伯或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.astronomer.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyAstronomerEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockAstronomerEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.astronomer.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原观测台外院', '花费1行动到达原观测台净空外院。成年普通人霍伯在2米外持自己的唯一原普通短棍，身后原出口可退出。没有挪走观测仪器、星表、工具或客户原灯。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('霍伯自行让开原通路', '霍伯听取三项真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有读心、强迫服从或额外扮演与掌握奖励。');
    } else ctx.note('霍伯仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ASTRONOMER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原观测台外院的有限冲突', ASTRONOMER_ENCOUNTER_STORY);
}
/** The original present adult, exact arrival week and current contiguous round. */
export function hasAstronomerDisputeOpponent(s: SliceState): boolean {
  const e = s.astronomer?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'ASTRONOMER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasAstronomerOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleAstronomerEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.astronomer.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'ASTRONOMER_DISPUTE') throw new Error('没有正在进行的天文学家原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知天文学家冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasAstronomerOpenPractice(s) ||
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
      !s.seer.completedSources.includes('astronomer-dispute')) award('astronomer-dispute', 25);
  s.combat = null;
  ctx.note('原观测台外院真实冲突结束', e.status === 'LOST' ? '玩家真实死亡已经结算，没有复活或奖励；原结果保留。'
    : e.status === 'RETREATED' ? '你沿实际原出口退出，没有瞬移、追逐、拖带霍伯或拿走他的原棍；原伤势与消耗保留，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '霍伯在原战斗中真实死亡，原尸体与自己的原棍留在外院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '霍伯仍活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateAstronomerEncounter(s: SliceState): boolean {
  const e = s.astronomer.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'astronomer-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'paragon' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'ASTRONOMER_DISPUTE';
  if (!initial && (!reportsComplete(s) || hasAstronomerOpenPractice(s) ||
      s.astronomer.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.astronomer.promotionWeek || e.attemptWeek < s.astronomer.practice.observedWeek!)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasAstronomerDisputeOpponent(s);
  if (c?.encounterId === 'ASTRONOMER_DISPUTE') return false;
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
