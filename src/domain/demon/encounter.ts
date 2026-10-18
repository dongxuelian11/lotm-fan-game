import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const DEMON_ENCOUNTER_STORY = '完成至少一项真实报告后，可实际前往原旧货库独立外院。成年普通人莫顿因场地预约误会持自己的普通短棍堵路；双方相距2米，原外院净空且没有旁人，彼此实际可见。身后原普通出口净空可退出，不是追逐，不移动他人或夺棍。本次只是普通场地争执，没有已知已经付诸行动的近期致命袭击计划，不自动触发危险预感；能力读取本人实际灵性与紧绷，失败也付成本。（本作原创G）';

export function blockDemonEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'abyss' || s.progression.sequence !== 6) return '先成为恶魔。';
  if ((s.demon.practice.body !== 'NORMAL' || s.demon.practice.flame === 'LIT')) return '先恢复自己的正常身体形态，并实际熄灭原盆火焰。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原旧货库。';
  if (Object.values(s.demon.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.demon.cases).some(x => x.status === 'RESOLVED')) return '先完成一项恶魔实践与真实报告。';
  if (s.demon.encounter.status !== 'AVAILABLE') return '本次外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.demon.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyDemonEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockDemonEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.demon.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原旧货库独立外院', '花费1行动到达原外院。成年普通人莫顿与他自己的普通短棍在2米外实际可见，原通道净空、没有旁人，身后原出口可退出；本次没有移动莫顿或他的物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('莫顿自行让开原通路', '你依据已完成的实践报告说明这次场地使用。莫顿听取澄清后自行让路，没有被改写意愿，没有转移原短棍，也没有额外扮演或掌握奖励。');
    } else ctx.note('莫顿仍不愿让路', '本次交涉没有消除误会，1行动已付，本人的拒绝保留。可以离开，下一真实周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DEMON_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原旧货库外院的有限冲突', DEMON_ENCOUNTER_STORY + '原出口始终可主动撤退，不进入普通追逐；真实伤势和死亡仍由共同战斗结算。');
}
/** Only the real current courtyard contact, never an unrelated first-case carrier. */
export function hasDemonDisputeOpponent(s: SliceState): boolean {
  const e = s.demon?.encounter, combat = s.combat;
  return s.progression?.pathwayId === 'abyss' && s.progression.sequence === 6 &&
    s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 &&
    s.activeEvent === null && s.world.city === 'BACKLUND' && combat !== null &&
    combat.encounterId === 'DEMON_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 && Number.isFinite(combat.enemyMind) && combat.enemyMind > 0 &&
    s.demon.practice.body === 'NORMAL' && s.demon.practice.flame !== 'LIT' && e?.status === 'FIGHTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 && e.startHistoryIndex! <= s.combatHistory.length &&
    Object.values(s.demon.cases).some(r => r.status === 'RESOLVED') &&
    Object.values(s.demon.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
export function settleDemonEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.demon.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'DEMON_DISPUTE') throw new Error('没有正在进行的恶魔外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知恶魔冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('demon-dispute', 25);
  s.combat = null;
  ctx.note('原旧货库外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，莫顿和他的原短棍留在原处。实际消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归莫顿。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演，不治疗，不补灵性、不清除紧绷。');
}
