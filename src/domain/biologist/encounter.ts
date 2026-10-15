import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const BIOLOGIST_ENCOUNTER_STORY = '完成至少一项真实报告后，可实际前往原苗圃温室独立外院。成年普通门工洛恩因场地出入误会持自己的普通短棍堵路，原棍在本人手中HAND；双方相距2米，彼此实际可见，原外院净空，无旁人或神奇物品。原封样本与两株原苗始终留在同一温室，没有进入战场。身后原普通出口净空可退出，不是追逐，不移动他人、夺棍或凭空生成生物；本次有限能力不涉及现实危险生物、无条件治疗或德鲁伊变形、催化和沼泽。（现场与全部数值为本作原创G）';

export function hasBiologistOpenPractice(s: SliceState): boolean {
  return Object.values(s.biologist.cases).some(r => r.contactOpen);
}
export function blockBiologistEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'mother' || s.progression.sequence !== 6) return '先成为生物学家。';
  if (hasBiologistOpenPractice(s)) return '先停止本次有限能力、放稳同一原样本与原苗并退开。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原苗圃温室。';
  if (Object.values(s.biologist.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.biologist.cases).some(x => x.status === 'RESOLVED')) return '先完成一项生物学家实践与真实报告。';
  if (s.biologist.encounter.status !== 'AVAILABLE') return '本次外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.biologist.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyBiologistEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockBiologistEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.biologist.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原苗圃温室独立外院', '花费1行动到达原外院。成年普通门工洛恩与本人普通短棍在2米外实际可见，原通道净空、没有旁人，身后原出口可退出；本次没有移动洛恩或他的物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('洛恩自行让开原通路', '你依据已完成的实践报告说明这次场地使用。洛恩听取普通澄清后自行让路，没有被强迫改变心智，没有转移原短棍或温室原苗，也没有额外扮演或掌握奖励。');
    } else ctx.note('洛恩仍不愿让路', '本次交涉没有消除误会，1行动已付，本人的拒绝保留。可以离开，下一真实周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'BIOLOGIST_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原苗圃温室外院的有限冲突', BIOLOGIST_ENCOUNTER_STORY + '原出口始终可主动撤退，不进入普通追逐；真实伤势和死亡仍由共同战斗结算。');
}
/** Only the actual present courtyard opponent, never a first-case or practice substitute. */
export function hasBiologistDisputeOpponent(s: SliceState): boolean {
  const e = s.biologist?.encounter, combat = s.combat;
  return s.progression?.pathwayId === 'mother' && s.progression.sequence === 6 &&
    s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 &&
    s.activeEvent === null && s.world.city === 'BACKLUND' && combat !== null &&
    combat.encounterId === 'BIOLOGIST_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 && Number.isFinite(combat.enemyMind) && combat.enemyMind > 0 &&
    !hasBiologistOpenPractice(s) && e?.status === 'FIGHTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 && e.startHistoryIndex! <= s.combatHistory.length &&
    Object.values(s.biologist.cases).some(r => r.status === 'RESOLVED') &&
    Object.values(s.biologist.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
export function settleBiologistEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.biologist.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'BIOLOGIST_DISPUTE') throw new Error('没有正在进行的生物学家外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知生物学家冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('biologist-dispute', 25);
  s.combat = null;
  ctx.note('原苗圃温室外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，洛恩和他的原短棍留在原处。本次有限能力已结束，实际消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，本次有限能力已结束，原短棍仍归洛恩。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演，不治疗，不补灵性。');
}
