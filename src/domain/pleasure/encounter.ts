import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const PLEASURE_ENCOUNTER_STORY = '完成至少一项报告后，可实际前往原独立练习场外的空旷庭院。成年马伦因场地预约误会，持自己的普通短棍堵路；双方相距2米，原固定照明清楚、原地面净空且没有旁人，身后原普通出口可退出。不是追逐，不移动他人或夺棍；日常接触须先明确松开手腕、结束谈话或清理原空框并离开。练习丝线不能带入实战，战斗须另行实际布丝；魅惑不能代替本人同意。（原创G）';
export function blockPleasureEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 6) return '先成为欢愉魔女。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原独立练习场。';
  if (s.pleasure.practice.wrist !== 'FREE' || s.pleasure.practice.fireSilk === 'ON_FRAME') return '先实际松开手腕或清理原空框上的薄丝。';
  if (Object.values(s.pleasure.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.pleasure.cases).some(x => x.status === 'RESOLVED')) return '先完成一项欢愉魔女实践与报告。';
  if (s.pleasure.encounter.status !== 'AVAILABLE') return '外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.pleasure.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyPleasureEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockPleasureEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.pleasure.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原外院并核对现场', '花费1行动到达原外院。马伦与原普通短棍在2米外可见；原通道净空、没有旁人，原固定灯照清楚照着马伦与净空的原地，身后原出口可退出，未移动物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('马伦自行让开原通路', '你依据已完成的公开实践报告说明此次场地使用，马伦听取澄清后自行让路；没有改写他的意愿、转移原短棍或额外扮演奖励。');
    } else ctx.note('马伦仍不愿让路', '本次交涉未能消除误会，1行动已付。本人拒绝保留，可以离开，下周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length; e.silkPrepared = false; e.boundRound = null;
  s.combat = { encounterId: 'PLEASURE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('独立练习场外院的有限冲突', PLEASURE_ENCOUNTER_STORY + '本次到场的实际观察支持当前战斗；原出口仍可主动撤退，不进入普通追逐。');
}
export function settlePleasureEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.pleasure.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'PLEASURE_DISPUTE') throw new Error('没有正在进行的欢愉魔女外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知欢愉魔女冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('pleasure-dispute', 25);
  e.silkPrepared = false; e.boundRound = null;
  s.combat = null;
  ctx.note('外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，马伦和原短棍留在原处。本次临时战斗丝线已解除，消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，本次临时战斗丝线已解除，原短棍仍归马伦。实际有效参战才给予一次单项掌握25，不增加扮演，不治疗伤势。');
}
