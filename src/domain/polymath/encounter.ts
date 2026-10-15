import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const POLYMATH_ENCOUNTER_STORY = '完成至少一项报告后，可实际前往原借阅馆教学室外院。成年来访者伊恩因场地预约误会持自己的普通短棍堵路；双方相距2米，原通道净空且没有旁人，原固定灯照清楚照着伊恩与净空的原地，已实际学会的低强闪光才可作有限弱化模仿。身后原普通出口可退出，不是追逐，不移动他人或夺棍。教学接触必须先实际结束短效并离开；本场不自动加入薄冰或鼓舞样本，也不借用未见或未学会的能力。（原创G）';
export function blockPolymathEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 6) return '先成为博学者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原借阅馆教学室。';
  if (Object.values(s.polymath.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.polymath.cases).some(x => x.status === 'RESOLVED')) return '先完成一项博学者实践与报告。';
  if (s.polymath.encounter.status !== 'AVAILABLE') return '外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.polymath.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyPolymathEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockPolymathEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.polymath.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原外院并核对现场', '花费1行动到达原外院。伊恩与原普通短棍在2米外可见；原通道净空、没有旁人，原固定灯照清楚照着伊恩与净空的原地，身后原出口可退出，未移动物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('伊恩自行让开原通路', '你依据已完成的公开实践报告说明此次场地使用，伊恩听取澄清后自行让路；没有改写他的意愿、转移原短棍或额外扮演奖励。');
    } else ctx.note('伊恩仍不愿让路', '本次交涉未能消除误会，1行动已付。本人拒绝保留，可以离开，下周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'POLYMATH_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('借阅馆教学室外院的有限冲突', POLYMATH_ENCOUNTER_STORY + '本次到场的实际观察支持当前战斗；原出口仍可主动撤退，不进入普通追逐。');
}
export function settlePolymathEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.polymath.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'POLYMATH_DISPUTE') throw new Error('没有正在进行的博学者外院冲突。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('polymath-dispute', 25);
  s.combat = null;
  ctx.note('外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，伊恩和原短棍留在原处。消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归伊恩。实际有效参战才给予一次单项掌握25，不增加扮演，不治疗伤势。');
}
