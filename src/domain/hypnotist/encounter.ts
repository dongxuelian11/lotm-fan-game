import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const HYPNOTIST_ENCOUNTER_STORY = '完成至少一项报告后，你可实际前往会所后门：成年会所来访者罗温因场地预约误会持自己的普通短棍堵路。到场可见双方相距2米，原空通道没有旁人或可燃物，身后原出口仍可退出。可以澄清或承担战斗风险；不是追逐，不移动箱物，不夺走短棍。（原创G）';
export function blockHypnotistEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 6) return '先成为催眠师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原会所。';
  if (Object.values(s.hypnotist.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.hypnotist.cases).some(x => x.status === 'RESOLVED')) return '先完成一项催眠师实践与报告。';
  if (s.hypnotist.encounter.status !== 'AVAILABLE') return '后门争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.hypnotist.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyHypnotistEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockHypnotistEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.hypnotist.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原后门并核对现场', '花费1行动到达原后门。罗温与原普通短棍在2米外可见；空通道没有旁人或可燃物，身后原出口可退出，未移动物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('罗温自行让开原通路', '你依据已完成的公开练习报告说明此次场地使用，罗温听取澄清后自行让路；没有改写他的意愿、转移原短棍或额外扮演奖励。');
    } else ctx.note('罗温仍不愿让路', '本次交涉未能消除误会，1行动已付。本人拒绝保留，可以离开，下周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'HYPNOTIST_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('会所后门的有限冲突', HYPNOTIST_ENCOUNTER_STORY + '本次到场的实际观察支持当前战斗；原出口仍可主动撤退，不进入普通追逐。');
}
export function settleHypnotistEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.hypnotist.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'HYPNOTIST_DISPUTE') throw new Error('没有正在进行的催眠师后门冲突。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && effective) award('hypnotist-dispute', 25);
  s.combat = null;
  ctx.note('后门冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，罗温和原短棍留在原处。消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归罗温。实际有效参战才给予一次单项掌握25，不增加扮演，不治疗伤势。');
}
