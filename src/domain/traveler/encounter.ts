import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { TRAVELER_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const TRAVELER_ENCOUNTER_STORY = '完成至少一项真实报告，实际回到练习入口、归还导师同一原木牌并让自愿场务米拉沿原路返回后，可花1行动走到原仓库独立净空私人厅。成年仓库守门人贝兰因场地使用误会，在2米外持自己的唯一原普通短棍抵抗。到场时实际普通步行核对原交手点、侧面相距2米的净空落点和返回原交手点的同一路径；原固定灯照清楚，身后原普通出口畅通，没有旁人或追逐。人物、有限场景和数值均为原创G。战斗短旅行只在此已核实净空现场，以2灵性去、2灵性回的成对实际移动牵制；原身体和自有装备一起返回原交手点，不携带贝兰、不取棍、不穿越关闭路线。释放记录只使用原STORED样本和2灵性，不制造记录，无形之手本阶段只用于获准生活取牌，不加入攻击。';

/** All outstanding bodies, permission and the same physical card need cleanup. */
export function hasTravelerOpenPractice(s: SliceState): boolean {
  const p = s.traveler.practice;
  return s.traveler.ritual.at !== 'HOME' || p.position !== 'ENTRY' || p.card !== 'DESK' ||
    p.companionPosition !== 'ENTRY' || p.consent ||
    Object.values(s.traveler.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    Object.values(s.recorder.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return TRAVELER_CASE_IDS.some(id => {
    const r = s.traveler.cases[id];
    return r?.status === 'RESOLVED' && r.contactOpen === false && r.closes >= 1;
  });
}
export function blockTravelerEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'door' || s.progression.sequence !== 5) return '先成为旅行家。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原仓库独立净空私人厅。';
  if (hasTravelerOpenPractice(s)) return '先实际回到原练习入口、归还同一原木牌、让米拉沿原路返回并结束同意与接触，或取消尚未实施的准备。';
  if (!reportsComplete(s)) return '先完成至少一项旅行家真实实践报告。';
  if (s.traveler.encounter.status !== 'AVAILABLE') return '本段私人厅争议已有结果，不能重新生成贝兰或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.traveler.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再次普通澄清。' : null;
}
export function applyTravelerEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockTravelerEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.traveler.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原仓库私人厅并核对落点', '花费1行动实际到场。成年仓库守门人贝兰在2米外持自己的唯一原普通短棍；双方仍是各自原身体。你在冲突前普通步行核对原交手点至侧面2米原净空落点，再普通步行回原交手点；原固定照明清楚、无旁人，原普通出口畅通。没有借来任何同伴、转移原棍、补充灵性或开启全球旅行菜单。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('贝兰自行让开原通路', '成年仓库守门人贝兰听取真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有用旅行或记录强迫他的意愿，也没有额外扮演与掌握奖励。');
    } else ctx.note('贝兰仍然拒绝让路', '本次1行动已付，贝兰的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'TRAVELER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原仓库私人厅的有限冲突', TRAVELER_ENCOUNTER_STORY);
}
/** The actual paid arrival and contiguous rounds bind this one original adult. */
export function hasTravelerDisputeOpponent(s: SliceState): boolean {
  const e = s.traveler?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'door' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'TRAVELER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasTravelerOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleTravelerEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.traveler.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'TRAVELER_DISPUTE') throw new Error('没有正在进行的旅行家原私人厅冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知旅行家冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasTravelerOpenPractice(s) ||
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
      !s.seer.completedSources.includes('traveler-dispute')) award('traveler-dispute', 25);
  s.combat = null;
  ctx.note('原仓库私人厅真实冲突结束', e.status === 'LOST' ? '玩家在与成年仓库守门人贝兰的真实冲突中死亡，原尸体与各自原物留在当前私人厅，已付灵性和已释放记录不返还；没有自动回家、复活、免费旅行或奖励。'
    : e.status === 'RETREATED' ? '你沿原私人厅实际普通出口退出，原身体与自己的装备一起离开；贝兰与他的原棍留在原处，没有追逐、免费瞬移或拖带他人。原伤势、灵性消耗及原记录释放保留，没有奖励，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '成年仓库守门人贝兰在原战斗中真实死亡，原尸体与自己的原棍留在私人厅，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性或记录。'
    : '成年仓库守门人贝兰仍然活着，在原私人厅自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性或记录。');
}
export function validateTravelerEncounter(s: SliceState): boolean {
  const e = s.traveler.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'traveler-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'door' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'TRAVELER_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.traveler.promotionWeek === null || e.attemptWeek === null || e.attemptWeek < s.traveler.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasTravelerDisputeOpponent(s);
  if (c?.encounterId === 'TRAVELER_DISPUTE') return false;
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
