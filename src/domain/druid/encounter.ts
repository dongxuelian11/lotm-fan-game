import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const DRUID_ENCOUNTER_STORY = '完成至少一项真实报告，并实际退出原土道、归回原标记及让原苗留在原床后，可花1行动沿原普通通路走到伊芙原训练花园的独立边庭。本作原创成年普通园工马伦因场地出入误会，持自己的原普通短棍在2米外抵抗，原棍在本人手中HAND；双方实际可见，脚下是已核实且净空的浅普通壤土，只允许原落脚处总长不超过1米的局部潜入再出。原土下没有金属、地基、管线或生物，不外推到未知地面；身后原干燥普通侧路和出口畅通，无旁人、追逐或神奇物品。地下潜行3灵性覆盖一次连续完整动作，实际身体沉入后在同一原落脚处再出、壤土稳定；不会留存地下状态、把马伦埋入地面、改变整片地形或保证免伤。可以普通澄清或沿原干燥侧路退出，真实伤势与死亡仍由共同战盘结算。（人物、现场、范围与全部数值为本作原创G）';

export function hasDruidOpenPractice(s: SliceState): boolean {
  const p = s.druid.practice;
  return p.position !== 'NEAR' || p.soil !== 'SETTLED' || p.marker !== 'BOX' || p.seedlings !== 'RESTING' || p.note === 'WRITTEN' ||
    [s.druid.cases, s.biologist.cases, s.harvestpriest.cases, s.physician.cases, s.cultivator.cases]
      .some(cases => Object.values(cases).some(r => r.contactOpen || r.status === 'PREPARED'));
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.druid.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
export function blockDruidEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'mother' || s.progression.sequence !== 5) return '先成为德鲁伊。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原训练花园边庭。';
  if (hasDruidOpenPractice(s)) return '先实际退出原土道、让壤土稳定、归回原标记、放好原苗与已写记录；旧序列实践也须收束。';
  if (!reportsComplete(s)) return '先完成至少一项德鲁伊真实实践与报告。';
  if (s.druid.encounter.status !== 'AVAILABLE') return '这次马伦原花园边庭争议已有结果，不能重复开启或重新生成原敌。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.druid.encounter.attemptWeek === s.week
    ? '本周已经交涉，马伦本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyDruidEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockDruidEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.druid.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原训练花园浅壤土边庭', '花费1行动沿原普通通路到达训练花园边庭。成年普通园工马伦持自己的原普通短棍在2米外，双方实际可见；已核实脚下净空浅普通壤土与身后原干燥侧路出口，没有旁人、土下生物或追逐，不移动马伦或他的原棍。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('马伦自行让开原通路', '马伦听取真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有埋敌、移动原棍、改写意愿或额外扮演与掌握奖励。');
    } else ctx.note('马伦仍然拒绝让路', '本次1行动已付，马伦本人的拒绝与原棍归属保留；可离开，下一真实周再普通澄清，或承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DRUID_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('马伦原花园边庭的有限冲突', DRUID_ENCOUNTER_STORY);
}
/** The present original Maren scene, never inherited dry ground or a practice substitute. */
export function hasDruidDisputeOpponent(s: SliceState): boolean {
  const e = s.druid?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'mother' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'DRUID_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasDruidOpenPractice(s) || !reportsComplete(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleDruidEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.druid.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'DRUID_DISPUTE') throw new Error('没有正在进行的德鲁伊花园边庭冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知德鲁伊冲突结局。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasDruidOpenPractice(s) ||
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
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length)
    .some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('druid-dispute')) award('druid-dispute', 25);
  s.combat = null;
  ctx.note('马伦原花园边庭冲突结束', e.status === 'LOST'
    ? '与马伦冲突的真实死亡已经结算。原身体与各自原物留在原地面，任何已用的短地下潜行均已当次再出、壤土稳定；没有复活、返还消耗或奖励。'
    : e.status === 'RETREATED'
    ? '你的原身体沿原干燥普通侧路实际退出，马伦与他的原短棍留在原处。任何已用的短地下潜行均已当次再出、壤土稳定，没有地下驻留、追逐或额外奖励，实际消耗与伤势保留。'
    : outcome === 'ENEMY_DEAD'
    ? '成年普通园工马伦在原花园边庭真实死亡，原身体与自己的原棍留在稳定的原地面，不重新生成活人。真实伤势与死亡来自共同战盘；任何已用的短地下潜行均已当次再出，不埋敌、复活或退回消耗。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演、不治疗或补灵性。'
    : '马伦仍活着并自行停止抵抗，原棍仍归本人，各自原身体在稳定的原地面。任何已用的短地下潜行均已当次再出，不把人留在地下；仅本人存活且实际有效参战才给予一次单项掌握25，不增加扮演、不治疗或补灵性。');
}

export function validateDruidEncounter(s: SliceState): boolean {
  const e = s.druid.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'druid-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'mother' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'DRUID_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.druid.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.druid.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasDruidDisputeOpponent(s);
  if (c?.encounterId === 'DRUID_DISPUTE') return false;
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
