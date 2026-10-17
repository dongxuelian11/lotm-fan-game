import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const MENTOR_DISORDER_ENCOUNTER_STORY = '完成至少一项真实报告并实际收束原筹、路线与原笔记后，可花1行动走到原契约铺独立日光净空外院。本作原创成年普通人里斯因场地预约误会，持自己的原普通短棍在2米外抵抗；双方原身体在日光下实际可见，原地面净空，没有旁人、练习物或神奇物品，身后原出口畅通，没有追逐。可普通澄清或沿原出口撤退。有限混乱成功只偏移本轮下一次实际正贡献普通打击的轨迹一次；继承贿赂必须给出玩家实际持有的原礼物，不要求对方自愿接住，不控制人格、夺棍或改写归属。真实伤势与死亡仍由共同战盘结算。（人物、现场与全部数值为本作原创G）';

export function hasMentorDisorderOpenPractice(s: SliceState): boolean {
  const p = s.mentorDisorder.practice, old = s.corruptionBaron.practice;
  return p.markers !== 'SORTED' || !['READY', 'FREE'].includes(p.route) || !['BLANK', 'HANDED_OVER'].includes(p.note) ||
    Object.values(s.mentorDisorder.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    !['ORIGINAL', 'RESTORED'].includes(old.clauseOrder) || !['CRADLED', 'STOPPED'].includes(old.marker) ||
    !['READY', 'FREE'].includes(old.route) ||
    Object.values(s.corruptionBaron.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.mentorDisorder.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
export function blockMentorDisorderEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'black-emperor' || s.progression.sequence !== 5) return '先成为混乱导师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原契约铺。';
  if (hasMentorDisorderOpenPractice(s)) return '先实际收好两枚原筹、结束本次有限路线试验并交出原笔记；旧实践也须收束。';
  if (!reportsComplete(s)) return '先完成至少一项混乱导师真实实践与报告。';
  if (s.mentorDisorder.encounter.status !== 'AVAILABLE') return '这次里斯原外院争议已有结果，不能重复开启或重新生成原敌。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.mentorDisorder.encounter.attemptWeek === s.week
    ? '本周已经交涉，里斯本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyMentorDisorderEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockMentorDisorderEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.mentorDisorder.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原契约铺日光净空外院', '花费1行动沿原通路到达原外院。成年普通人里斯持自己的原普通短棍在2米外，日光下双方实际可见，身后原出口畅通，没有旁人；不移动里斯或他的原棍。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('里斯自行让开原通路', '里斯听取真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有施加混乱、改写意愿、扮演或掌握奖励。');
    } else ctx.note('里斯仍然拒绝让路', '本次1行动已付，里斯本人的拒绝与原棍归属保留；可离开，下一真实周再普通澄清，或承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'MENTOR_DISORDER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('里斯原外院的有限冲突', MENTOR_DISORDER_ENCOUNTER_STORY);
}
/** The present original Rees scene, not an inherited S6 opponent or a practice substitute. */
export function hasMentorDisorderDisputeOpponent(s: SliceState): boolean {
  const e = s.mentorDisorder?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'black-emperor' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'MENTOR_DISORDER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasMentorDisorderOpenPractice(s) || !reportsComplete(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleMentorDisorderEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.mentorDisorder.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'MENTOR_DISORDER_DISPUTE') throw new Error('没有正在进行的里斯原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知混乱导师冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasMentorDisorderOpenPractice(s) ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !c.lastRound ||
      c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(c.lastRound) ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && (i === c.lastRound!.round - 1 || r.retreat !== 'SUCCESS')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS'))) {
    throw new Error('结局与原回合、原身体结果或收束不一致，不能制造投降、死亡或奖励。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('mentor-disorder-dispute')) award('mentor-disorder-dispute', 25);
  s.combat = null;
  ctx.note('里斯原外院冲突结束', e.status === 'LOST'
    ? '玩家在原日光外院真实死亡，原身体与各自原物留在现场；本轮有限混乱与待用贿赂结束，实付灵性不退回，不复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出，里斯和自己的原短棍留在原处；没有追逐、瞬移、拖带或夺棍。本轮短效已结束，实际消耗、已给原礼物与原伤势保留，没有奖励。'
    : outcome === 'ENEMY_DEAD' ? '成年普通人里斯在原外院真实死亡，原尸体与自己的原棍留在原处，不重新生成活人。混乱没有自动致死；伤势与死亡来自共同战盘。原赠物仍在本场地面，本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性。'
    : '里斯仍然活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变；混乱没有强迫投降。原赠物仍在本场地面，本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性。');
}
export function validateMentorDisorderEncounter(s: SliceState): boolean {
  const e = s.mentorDisorder.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'mentor-disorder-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'black-emperor' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'MENTOR_DISORDER_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.mentorDisorder.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.mentorDisorder.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasMentorDisorderDisputeOpponent(s);
  if (c?.encounterId === 'MENTOR_DISORDER_DISPUTE') return false;
  if (e.startHistoryIndex === null) return e.status === 'AVAILABLE' || (e.status === 'RESOLVED' && e.attemptWeek !== null);
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS'))) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}
