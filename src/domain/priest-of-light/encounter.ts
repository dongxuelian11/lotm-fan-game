import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { PRIEST_OF_LIGHT_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const PRIEST_OF_LIGHT_ENCOUNTER_STORY = '完成至少一项真实报告，实际关闭净化光环、安抚受影响的友好灵体并由主人沿原路送回同一原灯笼，且已从冰内真实撤出、返回导师后，可花1行动前往原独立净空私人庭院。成年普通门房凯恩因场地使用误会，在2米外持自己的唯一原普通短棍抵抗；眼前原身体真实可见，身后原普通出口畅通，没有同伴、灵体、旁人或追逐。凯恩、场景、距离与有限数值是原创G，不复制首案携铃者或其他人物，不转移原棍。圣光对普通活人只作普通攻击，没有邪恶标签加成；继承短吟仅提供本槽自身优势，各自实付灵性。没有自动豁免友好灵体或无视全部防御的能力，不提前获得序列4无暗领域、复活或非凡特性净化。';

/** A prepared plan alone is not active contact; an off-site body, open aura,
 * unsettled spirit, displaced original lantern or inherited contract still is. */
export function hasPriestOfLightOpenPractice(s: SliceState): boolean {
  return s.priestOfLight.ritual.location !== 'GUIDE' || s.priestOfLight.practice.auraOpen ||
    s.priestOfLight.practice.spiritDistressed || s.priestOfLight.practice.lanternPosition !== 'NEAR' ||
    Object.values(s.priestOfLight.cases).some(r => r.contactOpen) ||
    s.notary.contract.tool !== 'TABLE' || s.notary.contract.active ||
    Object.values(s.notary.cases).some(r => r.contactOpen);
}

function reportsComplete(s: SliceState): boolean {
  return PRIEST_OF_LIGHT_CASE_IDS.some(id => {
    const r = s.priestOfLight.cases[id];
    return r?.status === 'RESOLVED' && r.contactOpen === false && r.closes >= 1;
  });
}
export function blockPriestOfLightEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'sun' || s.progression.sequence !== 5) return '先成为光之祭司。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原独立私人庭院。';
  if (hasPriestOfLightOpenPractice(s)) return '先实际关闭光环与接触、安抚并送回原友好灵体及灯笼，履行旧契约、归还原工具，并从仪式返回导师后再前往私人庭院。';
  if (!reportsComplete(s)) return '先完成至少一项光之祭司真实实践报告。';
  if (s.priestOfLight.encounter.status !== 'AVAILABLE') return '本段私人庭院争议已有结果，不能再生成普通门房凯恩或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.priestOfLight.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyPriestOfLightEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockPriestOfLightEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.priestOfLight.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原私人庭院', '花费1行动到达原独立净空私人庭院。成年普通门房凯恩在2米外可见并持自己的唯一原普通短棍，身后原普通出口可退出，无旁人或追逐；本次没有同伴或灵体，不召来栖灯、不转移原棍，也不补充灵性。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('普通门房凯恩自行让开原通路', '普通门房凯恩听取已完成的真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有使用圣光或短吟强迫服从，也没有额外扮演与掌握奖励。');
    } else ctx.note('普通门房凯恩仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'PRIEST_OF_LIGHT_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原私人庭院的有限冲突', PRIEST_OF_LIGHT_ENCOUNTER_STORY);
}
/** The original present adult, exact arrival week and current contiguous round. */
export function hasPriestOfLightDisputeOpponent(s: SliceState): boolean {
  const e = s.priestOfLight?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'sun' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'PRIEST_OF_LIGHT_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasPriestOfLightOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settlePriestOfLightEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.priestOfLight.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'PRIEST_OF_LIGHT_DISPUTE') throw new Error('没有正在进行的光之祭司原私人庭院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知光之祭司冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasPriestOfLightOpenPractice(s) ||
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
      !s.seer.completedSources.includes('priest-of-light-dispute')) award('priest-of-light-dispute', 25);
  s.combat = null;
  ctx.note('原私人庭院真实冲突结束', e.status === 'LOST' ? '玩家在原私人庭院与普通门房凯恩的真实冲突中死亡，原身体、各自原物和已付灵性均保留；没有复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原私人庭院的实际原出口退出，没有瞬移、追逐、拖带普通门房凯恩或拿走他的原棍；原伤势与消耗保留，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '普通门房凯恩在原战斗中真实死亡，原尸体与自己的原棍留在私人庭院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '普通门房凯恩仍活着，在原私人庭院自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validatePriestOfLightEncounter(s: SliceState): boolean {
  const e = s.priestOfLight.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'priest-of-light-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'sun' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'PRIEST_OF_LIGHT_DISPUTE';
  if (!initial && (!reportsComplete(s) ||
      s.priestOfLight.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.priestOfLight.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasPriestOfLightDisputeOpponent(s);
  if (c?.encounterId === 'PRIEST_OF_LIGHT_DISPUTE') return false;
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
