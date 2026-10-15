import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const SCROLL_PROFESSOR_ENCOUNTER_STORY = '完成至少一项真实报告后，可实际前往原法术教学室独立外院。成年普通人卡尔因场地预约误会持自己的普通短棍堵路；双方相距2米，原外院净空且没有旁人，彼此实际可见。身后原普通出口净空可退出，不是追逐，不移动他人或夺棍。原卷轴只有事先制成且本人明确授权时，才可在匹配战斗槽自动烧用一次；失败也真实耗尽。（本作原创G）';

export function blockScrollProfessorEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'hermit' || s.progression.sequence !== 6) return '先成为卷轴教授。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原法术教学室。';
  if (Object.values(s.scrollProfessor.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.scrollProfessor.cases).some(x => x.status === 'RESOLVED')) return '先完成一项卷轴教授实践与真实报告。';
  if (s.scrollProfessor.encounter.status !== 'AVAILABLE') return '本次外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.scrollProfessor.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyScrollProfessorEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockScrollProfessorEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.scrollProfessor.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原教学室独立外院', '花费1行动到达原外院。成年普通人卡尔与他自己的普通短棍在2米外实际可见，原通道净空、没有旁人，身后原出口可退出；本次没有移动卡尔或他的物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('卡尔自行让开原通路', '你依据已完成的实践报告说明这次场地使用。卡尔听取澄清后自行让路，没有被改写意愿，没有转移原短棍，也没有额外扮演或掌握奖励。');
    } else ctx.note('卡尔仍不愿让路', '本次交涉没有消除误会，1行动已付，本人的拒绝保留。可以离开，下一真实周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'SCROLL_PROFESSOR_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原教学室外院的有限冲突', SCROLL_PROFESSOR_ENCOUNTER_STORY + '原出口始终可主动撤退，不进入普通追逐；真实伤势和死亡仍由共同战斗结算。');
}
/** Only the real current courtyard contact, never an unrelated first-case carrier. */
export function hasScrollProfessorDisputeOpponent(s: SliceState): boolean {
  const e = s.scrollProfessor?.encounter, combat = s.combat;
  return s.progression?.pathwayId === 'hermit' && s.progression.sequence === 6 &&
    s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 &&
    s.activeEvent === null && s.world.city === 'BACKLUND' && combat !== null &&
    combat.encounterId === 'SCROLL_PROFESSOR_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 && Number.isFinite(combat.enemyMind) && combat.enemyMind > 0 &&
    e?.status === 'FIGHTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 && e.startHistoryIndex! <= s.combatHistory.length &&
    Object.values(s.scrollProfessor.cases).some(r => r.status === 'RESOLVED') &&
    Object.values(s.scrollProfessor.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
export function settleScrollProfessorEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.scrollProfessor.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'SCROLL_PROFESSOR_DISPUTE') throw new Error('没有正在进行的卷轴教授外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知卷轴教授冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('scroll-professor-dispute', 25);
  s.combat = null;
  ctx.note('原教学室外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，卡尔和他的原短棍留在原处。实际消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归卡尔。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演，不治疗，不补造卷轴。');
}
