import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const ROSE_BISHOP_ENCOUNTER_STORY = '完成至少一项真实报告后，可实际前往原旧物间独立外院。成年普通人维恩因场地预约误会持自己的普通短棍堵路；双方相距2米，原外院净空且没有旁人，彼此实际可见。身后原普通出口净空可退出，不是追逐，不移动他人或夺棍。日光充分，没有可用于藏匿的阴影；血肉能力只读取本人真实储备和原身体条件，失败也付成本。（本作原创G）';

export function blockRoseBishopEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'hanged-man' || s.progression.sequence !== 6) return '先成为蔷薇主教。';
  if (s.roseBishop.practice.shape !== 'NORMAL') return '先恢复自己的正常身体形态。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原旧物间。';
  if (Object.values(s.roseBishop.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.roseBishop.cases).some(x => x.status === 'RESOLVED')) return '先完成一项蔷薇主教实践与真实报告。';
  if (s.roseBishop.encounter.status !== 'AVAILABLE') return '本次外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.roseBishop.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyRoseBishopEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockRoseBishopEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.roseBishop.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原旧物间独立外院', '花费1行动到达原外院。成年普通人维恩与他自己的普通短棍在2米外实际可见，原通道净空、没有旁人，身后原出口可退出；本次没有移动维恩或他的物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('维恩自行让开原通路', '你依据已完成的实践报告说明这次场地使用。维恩听取澄清后自行让路，没有被改写意愿，没有转移原短棍，也没有额外扮演或掌握奖励。');
    } else ctx.note('维恩仍不愿让路', '本次交涉没有消除误会，1行动已付，本人的拒绝保留。可以离开，下一真实周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ROSE_BISHOP_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原旧物间外院的有限冲突', ROSE_BISHOP_ENCOUNTER_STORY + '原出口始终可主动撤退，不进入普通追逐；真实伤势和死亡仍由共同战斗结算。');
}
/** Only the real current courtyard contact, never an unrelated first-case carrier. */
export function hasRoseBishopDisputeOpponent(s: SliceState): boolean {
  const e = s.roseBishop?.encounter, combat = s.combat;
  return s.progression?.pathwayId === 'hanged-man' && s.progression.sequence === 6 &&
    s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 &&
    s.activeEvent === null && s.world.city === 'BACKLUND' && combat !== null &&
    combat.encounterId === 'ROSE_BISHOP_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 && Number.isFinite(combat.enemyMind) && combat.enemyMind > 0 &&
    s.roseBishop.practice.shape === 'NORMAL' && e?.status === 'FIGHTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 && e.startHistoryIndex! <= s.combatHistory.length &&
    Object.values(s.roseBishop.cases).some(r => r.status === 'RESOLVED') &&
    Object.values(s.roseBishop.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
export function settleRoseBishopEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.roseBishop.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'ROSE_BISHOP_DISPUTE') throw new Error('没有正在进行的蔷薇主教外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知蔷薇主教冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('rose-bishop-dispute', 25);
  s.combat = null;
  ctx.note('原旧物间外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，维恩和他的原短棍留在原处。实际消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归维恩。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演，不治疗，不补充血肉储备。');
}
