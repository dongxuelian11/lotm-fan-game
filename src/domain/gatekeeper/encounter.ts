import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { GATEKEEPER_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const GATEKEEPER_ENCOUNTER_STORY = '完成至少一项真实报告、实际结束接触、关门、召回出动原灵并取回导师同一原木牌后，可花1行动前往原独立净空私人庭院。成年旧纪念院看守洛克因场地使用误会，在2米外持自己的唯一原普通短棍抵抗；眼前原身体真实可见，身后原普通出口畅通，没有旁人或追逐。洛克、场景、距离与有限数值是原创G，不复制首案携铃者或其他人物，不转移原棍。只有以本次新约定真实进入玩家原体内的同一原灰羽，才可实付3灵性在一个动作内短助并返回；没有默认随从或额外自主行动。有限冥界门可被抵抗，当次动作内实际关闭，不放逐、搬运或即死，不获得序列4不死复活。';

/** Resting INSIDE alone permits ordinary life and combat. Unclosed contact,
 * a deployed spirit or the outstanding original marker requires real cleanup;
 * the inherited already-delivered original letter stays with its recipient. */
export function hasGatekeeperOpenPractice(s: SliceState): boolean {
  return s.gatekeeper.practice.gateOpen || s.gatekeeper.practice.marker !== 'DESK' ||
    s.gatekeeper.companion.status === 'DEPLOYED' ||
    Object.values(s.gatekeeper.cases).some(r => r.contactOpen) ||
    Object.values(s.spiritGuide.cases).some(r => r.contactOpen);
}

function reportsComplete(s: SliceState): boolean {
  return GATEKEEPER_CASE_IDS.some(id => {
    const r = s.gatekeeper.cases[id];
    return r?.status === 'RESOLVED' && r.contactOpen === false && r.closes >= 1;
  });
}
export function blockGatekeeperEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 5) return '先成为看门人。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原旧纪念院独立私人庭院。';
  if (hasGatekeeperOpenPractice(s)) return '先实际关门、结束接触并沿原路返回，召回出动原灰羽、取回导师同一原木牌后再前往私人庭院。';
  if (!reportsComplete(s)) return '先完成至少一项看门人真实实践报告。';
  if (s.gatekeeper.encounter.status !== 'AVAILABLE') return '本段私人庭院争议已有结果，不能再生成成年旧纪念院看守洛克或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.gatekeeper.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyGatekeeperEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockGatekeeperEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.gatekeeper.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原私人庭院', '花费1行动到达原独立净空私人庭院。成年旧纪念院看守洛克在2米外可见并持自己的唯一原普通短棍，身后原普通出口可退出，无旁人或追逐；当前原体内如有依新约定真实进入的同一原灰羽，它随原身体实际到场；否则没有可用原灵。旧单封信约定不授权参战，不转移原棍，也不补充灵性。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('成年旧纪念院看守洛克自行让开原通路', '成年旧纪念院看守洛克听取已完成的真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有使用冥界门或原灰羽短助强迫服从，也没有额外扮演与掌握奖励。');
    } else ctx.note('成年旧纪念院看守洛克仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'GATEKEEPER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原私人庭院的有限冲突', GATEKEEPER_ENCOUNTER_STORY);
}
/** The original present adult, exact arrival week and current contiguous round. */
export function hasGatekeeperDisputeOpponent(s: SliceState): boolean {
  const e = s.gatekeeper?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'GATEKEEPER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasGatekeeperOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleGatekeeperEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.gatekeeper.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'GATEKEEPER_DISPUTE') throw new Error('没有正在进行的看门人原私人庭院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知看门人冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasGatekeeperOpenPractice(s) ||
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
      !s.seer.completedSources.includes('gatekeeper-dispute')) award('gatekeeper-dispute', 25);
  s.combat = null;
  ctx.note('原私人庭院真实冲突结束', e.status === 'LOST' ? '玩家在原私人庭院与成年旧纪念院看守洛克的真实冲突中死亡，原尸体、各自原物和已付灵性均保留；原体内如有灰羽已在这个战场离体，没有自动回家、复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原私人庭院的实际原出口退出，没有瞬移、追逐、拖带成年旧纪念院看守洛克或拿走他的原棍；原伤势与消耗保留，实际仍在体内的原灰羽随你原身体退出，未被清空或送回工作室；不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '成年旧纪念院看守洛克在原战斗中真实死亡，原尸体与自己的原棍留在私人庭院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '成年旧纪念院看守洛克仍活着，在原私人庭院自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateGatekeeperEncounter(s: SliceState): boolean {
  const e = s.gatekeeper.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'gatekeeper-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'death' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'GATEKEEPER_DISPUTE';
  if (!initial && (!reportsComplete(s) ||
      s.gatekeeper.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.gatekeeper.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasGatekeeperDisputeOpponent(s);
  if (c?.encounterId === 'GATEKEEPER_DISPUTE') return false;
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
