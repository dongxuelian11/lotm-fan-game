import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const CALAMITY_PRIEST_ENCOUNTER_STORY = '完成至少一项真实报告后，可实际前往原报时铺独立外院。成年普通人杜兰因场地预约误会持自己普通短棍堵路，原棍在他手中HAND；双方相距2米，彼此实际可见，原外院净空，没有松板、旁人或可用灾源。身后原普通出口净空可退出，不是追逐，不移动他人或夺棍。不把原工作间小板搬来作战，不凭空创造灾源；灾祸察觉不是全知，幸运不保证自身或他人无伤，精神风暴不是心智控制。（现场与全部数值为本作原创G）';

export function blockCalamityPriestEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'wheel' || s.progression.sequence !== 6) return '先成为灾祸教士。';
  if ((s.calamityPriest.practice.hazard === 'NOTICED' || ['UNSTABLE', 'FALLEN'].includes(s.calamityPriest.practice.board) || s.calamityPriest.practice.contact === 'FOCUSED')) return '先实际稳固原货架、收妥原小板或停止并等候本次短效结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原报时铺。';
  if (Object.values(s.calamityPriest.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.calamityPriest.cases).some(x => x.status === 'RESOLVED')) return '先完成一项灾祸教士实践与真实报告。';
  if (s.calamityPriest.encounter.status !== 'AVAILABLE') return '本次外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.calamityPriest.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyCalamityPriestEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockCalamityPriestEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.calamityPriest.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原报时铺独立外院', '花费1行动到达原外院。成年普通人杜兰与他自己的普通短棍在2米外实际可见，原通道净空、没有旁人，身后原出口可退出；本次没有移动杜兰或他的物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('杜兰自行让开原通路', '你依据已完成的实践报告说明这次场地使用。杜兰听取澄清后自行让路，没有被改写意愿，没有转移原短棍，也没有额外扮演或掌握奖励。');
    } else ctx.note('杜兰仍不愿让路', '本次交涉没有消除误会，1行动已付，本人的拒绝保留。可以离开，下一真实周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CALAMITY_PRIEST_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原报时铺外院的有限冲突', CALAMITY_PRIEST_ENCOUNTER_STORY + '原出口始终可主动撤退，不进入普通追逐；真实伤势和死亡仍由共同战斗结算。');
}
/** Only the real current courtyard contact, never an unrelated first-case carrier. */
export function hasCalamityPriestDisputeOpponent(s: SliceState): boolean {
  const e = s.calamityPriest?.encounter, combat = s.combat;
  return s.progression?.pathwayId === 'wheel' && s.progression.sequence === 6 &&
    s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 &&
    s.activeEvent === null && s.world.city === 'BACKLUND' && combat !== null &&
    combat.encounterId === 'CALAMITY_PRIEST_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 && Number.isFinite(combat.enemyMind) && combat.enemyMind > 0 &&
    s.calamityPriest.practice.hazard !== 'NOTICED' && !['UNSTABLE', 'FALLEN'].includes(s.calamityPriest.practice.board) && s.calamityPriest.practice.contact !== 'FOCUSED' && e?.status === 'FIGHTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 && e.startHistoryIndex! <= s.combatHistory.length &&
    Object.values(s.calamityPriest.cases).some(r => r.status === 'RESOLVED') &&
    Object.values(s.calamityPriest.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
export function settleCalamityPriestEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.calamityPriest.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'CALAMITY_PRIEST_DISPUTE') throw new Error('没有正在进行的灾祸教士外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知灾祸教士冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('calamity-priest-dispute', 25);
  s.combat = null;
  ctx.note('原报时铺外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，杜兰和他的原短棍留在原处。实际消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，原短棍仍归杜兰。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演，不治疗，不补灵性，也不许诺下一次好运。');
}
