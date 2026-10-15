import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const STAR_MYSTIC_ENCOUNTER_STORY = '完成至少一项真实报告并实际收束原幕布、原眼镜、星光牢笼与原同伴后，可花1行动走到原教学室独立净空外院。本作原创成年普通空院看守布莱斯因场地预约误会，持自己的原普通短棍在2米外抵抗；双方原身体实际可见，原地面净空，身后原出口畅通，没有旁人、同伴或追逐。可先普通澄清，也可承担共同战斗的真实伤势与死亡风险。有限星光牢笼不直接伤人、不控制思想或使人自动投降；眼镜聚焦只针对眼前原敌，不读取未知物品、隐藏能力或未来行动。人物、场景、距离、成本、判定与战势数值均为本作G。';

/** Focus may briefly lift the owned glasses during this very combat round. */
function practiceClosed(s: SliceState, allowFocus = false): boolean {
  const p = s.starMystic.practice, e = s.starMystic.encounter;
  return p.screen === 'SHUT' && !p.cageActive && p.companionNode === 'WAITING' && p.playerNode === 'ROOM' &&
    (p.lenses !== 'HELD' || (allowFocus && e.focused)) &&
    Object.values(s.starMystic.cases).every(r => !r.contactOpen && r.status !== 'PREPARED') &&
    Object.values(s.scrollProfessor.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.starMystic.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
function noEffects(s: SliceState): boolean {
  return s.starMystic.encounter.focused === false && s.starMystic.encounter.cageReady === false;
}
export function blockStarMysticEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'hermit' || s.progression.sequence !== 5) return '先成为隐者途径的星象师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原教学室外院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先实际关幕、戴回原眼镜、解除原牢笼、让原同伴和本人沿原路返回，并结束接触或取消准备。';
  if (!reportsComplete(s)) return '先完成至少一项星象师真实实践与报告。';
  if (s.starMystic.encounter.status !== 'AVAILABLE') return '这次布莱斯外院争议已有结果，不能重复开启或重新生成原敌。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.starMystic.encounter.attemptWeek === s.week
    ? '本周已经交涉，布莱斯本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyStarMysticEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockStarMysticEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.starMystic.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原教学室净空外院', '花费1行动，本人沿原通路到达原外院。成年普通空院看守布莱斯在2米外持自己的原普通短棍，原身体实际可见，原地面净空，身后原出口畅通；没有旁人、同伴或追逐，不移动布莱斯或他的原棍。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('布莱斯自行让开原通路', '布莱斯听取已完成的真实报告与普通澄清后自行让路，仍活着并拥有自己的原棍；没有星光束缚、意愿改写或额外扮演、掌握奖励。');
    } else ctx.note('布莱斯仍然拒绝让路', '这次1行动已付，布莱斯本人的拒绝和原棍归属保留；可离开，下一真实周再澄清，或承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  e.focused = false; e.cageReady = false;
  s.combat = { encounterId: 'STAR_MYSTIC_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原教学室外院的有限冲突', STAR_MYSTIC_ENCOUNTER_STORY);
}
export function hasStarMysticDisputeOpponent(s: SliceState): boolean {
  const e = s.starMystic?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'hermit' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'STAR_MYSTIC_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || !practiceClosed(s, true) ||
      typeof e.focused !== 'boolean' || typeof e.cageReady !== 'boolean' ||
      (e.focused !== (s.starMystic.practice.lenses === 'HELD')) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleStarMysticEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.starMystic.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'STAR_MYSTIC_DISPUTE') throw new Error('没有正在进行的布莱斯原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知星象师冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || !practiceClosed(s) || !noEffects(s) ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !c.lastRound ||
      c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(c.lastRound) ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && (r === s.combatHistory.at(-1) || r.retreat !== 'SUCCESS')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS'))) {
    throw new Error('结局与原回合、原身体结果不一致，不能制造投降、改写死亡或发放奖励。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('star-mystic-dispute')) award('star-mystic-dispute', 25);
  s.combat = null;
  ctx.note('布莱斯原外院冲突结束', e.status === 'LOST'
    ? '玩家与成年普通空院看守布莱斯的真实冲突中死亡，原尸体、各自原物、实付精神与灵性保留；星光与聚焦已经结束，没有复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出，成年普通看守布莱斯和他的原短棍留在原处；没有追逐、瞬移或夺棍，已耗资源与原伤势保留，原眼镜戴回、临时牢笼消散，没有奖励。'
    : outcome === 'ENEMY_DEAD' ? '成年普通看守布莱斯在原外院真实死亡，原尸体与他的原短棍留在原处，不重新生成活人。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性或复制原卷轴。'
    : '成年普通看守布莱斯仍然活着，自行停止抵抗并放下自己的原短棍，原棍归属不变，没有被星光牢笼改写意愿。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补充原卷轴。');
}
export function validateStarMysticEncounter(s: SliceState): boolean {
  const e = s.starMystic.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'star-mystic-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && noEffects(s);
  const promoted = s.progression.pathwayId === 'hermit' && (s.progression.sequence === 5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'STAR_MYSTIC_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.starMystic.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.starMystic.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return noEffects(s) && hasStarMysticDisputeOpponent(s);
  if (c?.encounterId === 'STAR_MYSTIC_DISPUTE' || !noEffects(s)) return false;
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
