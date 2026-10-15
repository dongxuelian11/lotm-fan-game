import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const SHEPHERD_ENCOUNTER_STORY = '完成至少一项真实报告并收束原纸张、歌声、原笔记与实际接触后，可花1行动走到原指导室独立日光净空外院。本作原创成年普通门廊看守埃尔顿因场地使用误会，持自己的原普通短棍在2米外抵抗；双方原身体实际可见，原地面净空，身后原出口畅通，没有旁人、同伴或追逐。可先普通澄清，也可承担共同战斗的真实伤势与死亡风险。每一槽只可借当前一个已放牧原灵实际选定的方法，灵留在本人之内，不生成独立身体；原敌死亡不自动吞灵或增加库存。人物、场景、距离、成本、判定与战势数值均为本作G。';

function practiceClosed(s: SliceState): boolean {
  const p = s.shepherd.practice;
  return p.paper === 'TABLE' && !p.chorusOpen && p.note !== 'WRITTEN' && p.playerNode === 'DESK' &&
    Object.values(s.shepherd.cases).every(r => !r.contactOpen && r.status !== 'PREPARED') &&
    s.roseBishop.practice.shape === 'NORMAL' &&
    Object.values(s.roseBishop.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.shepherd.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
function noEffects(s: SliceState): boolean { return s.shepherd.encounter.blurReady === false; }
export function blockShepherdEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'hanged-man' || s.progression.sequence !== 5) return '先成为倒吊人途径的牧羊人。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原指导室外院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先实际归还原纸张、停止歌声、交出原笔记并返回原桌，结束接触或取消准备；本人恢复普通形态。';
  if (!reportsComplete(s)) return '先完成至少一项牧羊人真实实践与报告。';
  if (s.shepherd.encounter.status !== 'AVAILABLE') return '这次埃尔顿外院争议已有结果，不能重复开启或重新生成原敌。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.shepherd.encounter.attemptWeek === s.week
    ? '本周已经交涉，埃尔顿本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyShepherdEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockShepherdEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.shepherd.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原指导室日光净空外院', '花费1行动，本人沿原通路到达原外院。成年普通门廊看守埃尔顿在2米外持自己的原普通短棍，原身体实际可见，原地面净空，身后原出口畅通；没有旁人、独立召唤体或追逐，不移动埃尔顿或他的原棍。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('埃尔顿自行让开原通路', '埃尔顿听取已完成的真实报告与普通澄清后自行让路，仍活着并拥有自己的原棍；没有借灵强迫其意愿，也没有额外扮演、掌握或灵体奖励。');
    } else ctx.note('埃尔顿仍然拒绝让路', '这次1行动已付，埃尔顿本人的拒绝和原棍归属保留；可离开，下一真实周再澄清，或承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length; e.blurReady = false;
  s.combat = { encounterId: 'SHEPHERD_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原指导室外院的有限冲突', SHEPHERD_ENCOUNTER_STORY);
}
export function hasShepherdDisputeOpponent(s: SliceState): boolean {
  const e = s.shepherd?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'hanged-man' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'SHEPHERD_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || !practiceClosed(s) ||
      typeof e.blurReady !== 'boolean' ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleShepherdEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.shepherd.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'SHEPHERD_DISPUTE') throw new Error('没有正在进行的埃尔顿原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知牧羊人冲突结果。');
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
      !s.seer.completedSources.includes('shepherd-dispute')) award('shepherd-dispute', 25);
  s.combat = null;
  ctx.note('埃尔顿原外院冲突结束', e.status === 'LOST'
    ? '玩家在与成年普通门廊看守埃尔顿的真实冲突中死亡，原尸体与各自原物留在现场；实付灵性与储备不返还，临时模糊已经结束，不复活、不奖励、不生成或自动放牧新灵。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出，成年普通门廊看守埃尔顿和自己的原短棍留在原处；没有追逐、瞬移或夺棍。已耗资源与原伤势保留，临时模糊结束，已有原灵与当前选择保留，没有奖励。'
    : outcome === 'ENEMY_DEAD' ? '成年普通门廊看守埃尔顿在原外院真实死亡，原尸体与自己的原短棍留在原处，不重新生成活人，也不自动吞灵、放牧或填充库存。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗或补灵性；已有原灵与当前选择保留。'
    : '成年普通门廊看守埃尔顿仍然活着，自行停止抵抗并放下自己的原短棍，原棍归属不变；鼓舞与模糊没有强迫他的意愿。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗或增加原灵；已有原灵与当前选择保留。');
}
export function validateShepherdEncounter(s: SliceState): boolean {
  const e = s.shepherd.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'shepherd-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      typeof e.blurReady !== 'boolean' ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && noEffects(s);
  const promoted = s.progression.pathwayId === 'hanged-man' && (s.progression.sequence === 5||s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'SHEPHERD_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.shepherd.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.shepherd.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return noEffects(s) && hasShepherdDisputeOpponent(s);
  if (c?.encounterId === 'SHEPHERD_DISPUTE' || !noEffects(s)) return false;
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
