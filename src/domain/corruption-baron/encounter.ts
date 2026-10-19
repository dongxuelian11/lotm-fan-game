import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const CORRUPTION_BARON_ENCOUNTER_STORY = '完成至少一项真实报告后，可实际前往原契约铺独立外院。成年普通人沃恩因场地预约误会持自己的普通短棍堵路，原棍在本人手中HAND；双方相距2米，彼此实际可见，原外院净空，无旁人、原练习托盘或神奇物品。身后原普通出口净空可退出，不是追逐，不移动他人或夺棍。扭曲只能短暂作用于对手现有动作或意图，可抵抗；继承贿赂使用玩家原库存中真实给出的木筹，不要求本人自愿接住，不控制人格、移走原棍或改写归属。（现场与全部数值为本作原创G）';

export function hasCorruptionBaronOpenPractice(s: SliceState): boolean {
  const p = s.corruptionBaron.practice;
  return ['PENDING', 'ADJUSTED'].includes(p.clauseOrder) || ['ROLLING', 'SIDE_POCKET'].includes(p.marker) || ['MOVING', 'DIVERTED'].includes(p.route);
}
export function blockCorruptionBaronEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'black-emperor' || s.progression.sequence !== 6) return '先成为腐化男爵。';
  if (hasCorruptionBaronOpenPractice(s)) return '先实际恢复原核册次序、收停原木球或停止并等候本次路线短效结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原契约铺。';
  if (Object.values(s.corruptionBaron.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.corruptionBaron.cases).some(x => x.status === 'RESOLVED')) return '先完成一项腐化男爵实践与真实报告。';
  if (s.corruptionBaron.encounter.status !== 'AVAILABLE') return '本次外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.corruptionBaron.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyCorruptionBaronEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockCorruptionBaronEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.corruptionBaron.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原契约铺独立外院', '花费1行动到达原外院。成年普通人沃恩与本人普通短棍在2米外实际可见，原通道净空、没有旁人，身后原出口可退出；本次没有移动沃恩或他的物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('沃恩自行让开原通路', '你依据已完成的实践报告说明这次场地使用。沃恩听取澄清后自行让路，没有被改写意愿，没有转移原短棍，也没有额外扮演或掌握奖励。');
    } else ctx.note('沃恩仍不愿让路', '本次交涉没有消除误会，1行动已付，本人的拒绝保留。可以离开，下一真实周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CORRUPTION_BARON_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原契约铺外院的有限冲突', CORRUPTION_BARON_ENCOUNTER_STORY + '原出口始终可主动撤退，不进入普通追逐；真实伤势和死亡仍由共同战斗结算。');
}
/** Only the actual present courtyard opponent, never a first-case or practice substitute. */
export function hasCorruptionBaronDisputeOpponent(s: SliceState): boolean {
  const e = s.corruptionBaron?.encounter, combat = s.combat;
  return s.progression?.pathwayId === 'black-emperor' && s.progression.sequence === 6 &&
    s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 &&
    s.activeEvent === null && s.world.city === 'BACKLUND' && combat !== null &&
    combat.encounterId === 'CORRUPTION_BARON_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 && Number.isFinite(combat.enemyMind) && combat.enemyMind > 0 &&
    !hasCorruptionBaronOpenPractice(s) && e?.status === 'FIGHTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 && e.startHistoryIndex! <= s.combatHistory.length &&
    Object.values(s.corruptionBaron.cases).some(r => r.status === 'RESOLVED') &&
    Object.values(s.corruptionBaron.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
export function settleCorruptionBaronEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.corruptionBaron.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'CORRUPTION_BARON_DISPUTE') throw new Error('没有正在进行的腐化男爵外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知腐化男爵冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('corruption-baron-dispute', 25);
  s.combat = null;
  ctx.note('原契约铺外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，沃恩和他的原短棍留在原处。实际消耗、已给原木筹与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归沃恩，已给原木筹保留真实去向。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演，不治疗，不补灵性。');
}
