import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const SOOTHER_ENCOUNTER_STORY = '完成至少一项报告后，你可亲自前往原夜间值班室外空院：成年阿兰因场地使用误会持本人普通短棍挡住通路。到场实际可见双方相距2米，原固定灯光照着净空的原地面，原空院没有旁人，身后普通出口仍可退出。可以澄清或承担战斗风险；不是追逐，不封灵、不召灵、不夺走短棍。继承梦魇控制时本体不能移动，控制状态只属于本场。（原创G）';
export function blockSootherEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 6) return '先成为安魂师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原夜间值班室。';
  if (Object.values(s.soother.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.soother.cases).some(x => x.status === 'RESOLVED')) return '先完成一项安魂师实践与报告。';
  if (s.soother.encounter.status !== 'AVAILABLE') return '空院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次亲自到场需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.soother.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applySootherEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockSootherEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.soother.encounter; e.attemptWeek = s.week; e.pressure = 0; e.dreamLocked = false;
  ctx.note('亲自到原夜间空院核对现场', '花费1行动实际走到原夜间值班室外空院。成年阿兰和他自己的普通短棍在2米外可见；原固定灯光实际照着净空的原地面，原空院没有旁人，身后普通出口可退。此次亲眼到场建立本场来源，不借用旧梦魇遭遇的观察或控制。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('阿兰自行让开原通路', '你依据已经完成的有限报告澄清场地使用，阿兰听取后自行让路。没有替他改写决定、夺走短棍或增加扮演奖励。');
    } else ctx.note('阿兰仍不愿让路', '本次交涉未能消除误会，1行动已付。本人拒绝保留，你实际退到原出口外，下周可再澄清，或另花1行动重新到场并承担战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'SOOTHER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原夜间空院的有限冲突', SOOTHER_ENCOUNTER_STORY + '原出口仍可主动撤退；实际伤势和死亡风险保留，不进入普通追逐。');
}
export function settleSootherEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.soother.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'SOOTHER_DISPUTE') throw new Error('没有正在进行的安魂师空院冲突。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  e.pressure = 0; e.dreamLocked = false;
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && effective) award('soother-dispute', 25);
  s.combat = null;
  ctx.note('原空院冲突结束', (e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，阿兰和他的原短棍留在原处。消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归阿兰。本场实际有效参战才给予一次单项掌握25，不增加扮演，不治疗伤势。') + '本场梦境压力与锁定已解除，旧梦魇遭遇记录完整保留。');
}
