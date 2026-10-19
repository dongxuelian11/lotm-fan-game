import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const FIRE_THIEF_ENCOUNTER_STORY = '完成至少一项报告后，可以实际前往原练习室外的空院。原创成年贝林因场地预约误会持自己的普通短棍堵路；双方2米，原固定照明清楚、原地面净空、没有旁人，身后原普通出口可退出，不是追逐。他尚未在你面前施用非凡能力；只有本场真实施用后，你才亲见相应可尝试偷取的能力，未见时没有可窃取样本。原物归属不变，日常借用必须先等两种期限结束并实际离开。（原创G）';
export function blockFireThiefEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'error' || s.progression.sequence !== 6) return '先成为盗火人。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原练习室。';
  if (Object.values(s.fireThief.cases).some(x => x.contactOpen || x.status === 'PREPARED') || s.fireThief.loan.caseId !== null) return '先实际结束本次借用、核实原主恢复并离开，或取消尚未实施的准备。';
  if (!Object.values(s.fireThief.cases).some(x => x.status === 'RESOLVED')) return '先完成一项盗火人实践与报告。';
  if (s.fireThief.encounter.status !== 'AVAILABLE') return '外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次到场选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.fireThief.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyFireThiefEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockFireThiefEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.fireThief.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原外院并核对现场', '花费1行动到达原外院。成年贝林与他自己的普通短棍在2米外可见；原固定照明清楚、地面净空、没有旁人，身后原出口可退出，未移动物品。你尚未亲见可偷取的非凡能力。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('贝林自行让开原通路', '你依据已完成的公开报告澄清场地安排，贝林听取说明后自行让路；没有偷取念头、行动或意愿，原短棍仍归他，没有额外扮演奖励。');
    } else ctx.note('贝林仍不愿让路', '本次交涉未能消除误会，1行动已付，拒绝保留。可以离开，下周再澄清，或承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'FIRE_THIEF_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原练习室外院的有限冲突', '冲突现场已核对。尚未亲见可窃取能力，不能把日常志愿者的来源套给贝林。只有对方实际使用后才有对应偷取条件；偷取可能失败，借用与原主受限独立到期。原出口可主动撤退，不进入追逐。');
}
export function settleFireThiefEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.fireThief.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'FIRE_THIEF_DISPUTE') throw new Error('没有正在进行的盗火人外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知盗火人冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const remaining = e.battleLoan.targetRounds;
  if (remaining > 0) {
    const place = outcome === 'RETREATED' ? '你从原出口退出后的安全位置，贝林留在原院且不追逐' : outcome === 'PLAYER_DEAD' ? '玩家死亡后的原现场结算，存活的贝林留在原处' : '抵抗结束后的安全原现场';
    ctx.note('实际等待战后剩余受限期限', `${place}。实际经过剩余${remaining}个有限G现场时段，借用与原主受限分别到期；退出或抵抗结束没有瞬间提前归还。${outcome === 'ENEMY_DEAD' ? '贝林已经死亡，期限结束只清除短暂机制，不恢复生命、不复活，也不声称死人重新施放能力。' : '随后核实存活原主的原能力恢复可用，没有新增施放、灵性补充或物品转移。'}`);
  }
  e.battleLoan.playerRounds = 0; e.battleLoan.targetRounds = 0;
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('fire-thief-dispute', 25);
  s.combat = null;
  ctx.note('原外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。原短棍归属不变。' : e.status === 'RETREATED' ? '你从原出口实际退出，贝林与原短棍留在原处；实际等候了尚未到期的有限借用后果。消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归贝林。实际有效参战才给予一次原掌握池单项25，不增加扮演，不治疗伤势，不永久获得原敌能力。');
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateFireThiefEncounter(s: SliceState): boolean {
  const e = s.fireThief.encounter, b = e.battleLoan;
  if (!record(b) || Object.keys(b).sort().join('|') !== ['playerRounds', 'targetRounds', 'startedRound', 'uses'].sort().join('|')) return false;
  if (e.enemySpirituality !== 20 || typeof e.enemyCourageSeen !== 'boolean' || !integer(b.playerRounds, 0, 2) || !integer(b.targetRounds, 0, 3) || !integer(b.uses, 0, 1)) return false;
  if (b.startedRound === null) { if (b.playerRounds !== 0 || b.targetRounds !== 0 || b.uses !== 0) return false; }
  else {
    if (!integer(b.startedRound, 1) || !e.enemyCourageSeen || e.startHistoryIndex === null) return false;
    if (e.status === 'FIGHTING') {
      if (!s.combat || !integer(b.startedRound, 1, s.combat.round - 1)) return false;
      const elapsed = s.combat.round - 1 - b.startedRound;
      if (b.playerRounds !== (b.uses > 0 ? 0 : Math.max(0, 2 - elapsed)) || b.targetRounds !== Math.max(0, 3 - elapsed)) return false;
    } else if (b.playerRounds !== 0 || b.targetRounds !== 0) return false;
  }
  if (e.startHistoryIndex === null && (e.enemyCourageSeen || e.enemySpirituality !== 20 || b.startedRound !== null)) return false;
  return true;
}
