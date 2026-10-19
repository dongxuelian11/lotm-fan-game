import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { MYSTICISM_MAGISTER_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const MYSTICISM_MAGISTER_ENCOUNTER_STORY = '完成至少一项真实报告并实际收束接触和入梦仪式后，可花1行动前往原独立净空私人工院。成年普通人罗文因场地出入误会，在2米外持自己的唯一原普通短棍抵抗；眼前身体真实可见，身后原普通出口畅通，没有旁人或追逐。罗文、场景与有限数值是原创G，不复制伊恩或首案携铃者，不夺走原棍。继承低强闪光仍须原FLASH确已学会；另可耗用事先花钱、材料与灵性实际制成并仍持有的单次原闪光物，不现场补造，不把仪式入梦变成即时战斗法术。';

/** Preparation alone is not an active dream or contact; borrowing does not teleport a body. */
export function hasMysticismMagisterOpenPractice(s: SliceState): boolean {
  return s.mysticismMagister.practice.dreamOpen ||
    Object.values(s.mysticismMagister.cases).some(r => r.contactOpen) ||
    Object.values(s.polymath.cases).some(r => r.contactOpen);
}
function reportsComplete(s: SliceState): boolean {
  return MYSTICISM_MAGISTER_CASE_IDS.some(id => {
    const r = s.mysticismMagister.cases[id];
    return r?.status === 'RESOLVED' && r.contactOpen === false && r.closes >= 1;
  });
}
export function blockMysticismMagisterEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 5) return '先成为秘术导师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原独立私人工院。';
  if (hasMysticismMagisterOpenPractice(s)) return '先实际关闭本次接触与入梦仪式，再前往原私人工院。';
  if (!reportsComplete(s)) return '先完成至少一项秘术导师真实实践报告。';
  if (s.mysticismMagister.encounter.status !== 'AVAILABLE') return '本段工院争议已有结果，不能再生成罗文或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.mysticismMagister.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyMysticismMagisterEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockMysticismMagisterEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.mysticismMagister.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原私人工院', '花费1行动到达原独立净空私人工院。成年普通人罗文在2米外可见并持自己的唯一原普通短棍，身后原普通出口可退出，无旁人或追逐；本次不新增、转移或补充任何闪光原件、材料与借物。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('罗文自行让开原通路', '罗文听取已完成的真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有读心、强迫服从或额外扮演与掌握奖励。');
    } else ctx.note('罗文仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'MYSTICISM_MAGISTER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原私人工院的有限冲突', MYSTICISM_MAGISTER_ENCOUNTER_STORY);
}
/** The original present adult, exact arrival week and current contiguous round. */
export function hasMysticismMagisterDisputeOpponent(s: SliceState): boolean {
  const e = s.mysticismMagister?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'MYSTICISM_MAGISTER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasMysticismMagisterOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleMysticismMagisterEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.mysticismMagister.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'MYSTICISM_MAGISTER_DISPUTE') throw new Error('没有正在进行的秘术导师原工院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知秘术导师冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasMysticismMagisterOpenPractice(s) ||
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
      !s.seer.completedSources.includes('mysticism-magister-dispute')) award('mysticism-magister-dispute', 25);
  s.combat = null;
  ctx.note('原私人工院真实冲突结束', e.status === 'LOST' ? '玩家真实死亡已经结算，没有复活或奖励；原结果保留。'
    : e.status === 'RETREATED' ? '你沿实际原出口退出，没有瞬移、追逐、拖带罗文或拿走他的原棍；原伤势与消耗保留，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '罗文在原战斗中真实死亡，原尸体与自己的原棍留在工院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性或已耗原闪光物。'
    : '罗文仍活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性或已耗原闪光物。');
}
export function validateMysticismMagisterEncounter(s: SliceState): boolean {
  const e = s.mysticismMagister.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'mysticism-magister-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'white-tower' && (s.progression.sequence === 5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'MYSTICISM_MAGISTER_DISPUTE';
  if (!initial && (!reportsComplete(s) ||
      s.mysticismMagister.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.mysticismMagister.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasMysticismMagisterDisputeOpponent(s);
  if (c?.encounterId === 'MYSTICISM_MAGISTER_DISPUTE') return false;
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
