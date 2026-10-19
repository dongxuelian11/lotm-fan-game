import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const JUDGE_ENCOUNTER_STORY = '完成至少一项真实报告后，可实际前往原调解处独立外院。成年普通人埃文因场地预约误会持自己的普通短棍堵路，原棍在本人手中HAND；双方相距2米，彼此实际可见，原外院净空，无旁人、练习原木牌或神奇物品。身后原普通出口净空可退出，不是追逐，不移动他人或夺棍。权威不保证说真话；禁令只有限短时限制明确动作，可被抵抗，原出口不因禁令封闭，不附加惩戒骑士的惩罚、囚禁或死亡打击。（现场与全部数值为本作原创G）';

export function hasJudgeOpenPractice(s: SliceState): boolean {
  const p = s.judge.practice;
  return ['ADDRESSED', 'ATTENTIVE'].includes(p.audience) || ['ATTEMPTED', 'HELD'].includes(p.boundary) || ['OUTSIDE_TABLE', 'HELD_ON_TABLE'].includes(p.token);
}
export function blockJudgeEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'justiciar' || s.progression.sequence !== 6) return '先成为法官。';
  if (hasJudgeOpenPractice(s)) return '先实际停止本次权威或禁令、等候短效结束并安全放回原木牌。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原调解处。';
  if (Object.values(s.judge.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先实际结束当前接触或取消尚未实施的准备。';
  if (!Object.values(s.judge.cases).some(x => x.status === 'RESOLVED')) return '先完成一项法官实践与真实报告。';
  if (s.judge.encounter.status !== 'AVAILABLE') return '本次外院争议已有结果，不能重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.judge.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留，下周可再次澄清。' : null;
}
export function applyJudgeEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockJudgeEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.judge.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原调解处独立外院', '花费1行动到达原外院。成年普通人埃文与本人普通短棍在2米外实际可见，原通道净空、没有旁人，身后原出口可退出；本次没有移动埃文或他的物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('埃文自行让开原通路', '你依据已完成的实践报告说明这次场地使用。埃文听取普通澄清后自行让路，没有被强迫交出秘密，没有转移原短棍，也没有额外扮演或掌握奖励。');
    } else ctx.note('埃文仍不愿让路', '本次交涉没有消除误会，1行动已付，本人的拒绝保留。可以离开，下一真实周再澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'JUDGE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原调解处外院的有限冲突', JUDGE_ENCOUNTER_STORY + '原出口始终可主动撤退，不进入普通追逐；真实伤势和死亡仍由共同战斗结算。');
}
/** Only the actual present courtyard opponent, never a first-case or practice substitute. */
export function hasJudgeDisputeOpponent(s: SliceState): boolean {
  const e = s.judge?.encounter, combat = s.combat;
  return s.progression?.pathwayId === 'justiciar' && s.progression.sequence === 6 &&
    s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 &&
    s.activeEvent === null && s.world.city === 'BACKLUND' && combat !== null &&
    combat.encounterId === 'JUDGE_DISPUTE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 && Number.isFinite(combat.enemyMind) && combat.enemyMind > 0 &&
    !hasJudgeOpenPractice(s) && e?.status === 'FIGHTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 && e.startHistoryIndex! <= s.combatHistory.length &&
    Object.values(s.judge.cases).some(r => r.status === 'RESOLVED') &&
    Object.values(s.judge.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
export function settleJudgeEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.judge.encounter;
  if (e.status !== 'FIGHTING' || s.combat?.encounterId !== 'JUDGE_DISPUTE') throw new Error('没有正在进行的法官外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知法官冲突结局。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex ?? s.combatHistory.length).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('judge-dispute', 25);
  s.combat = null;
  ctx.note('原调解处外院冲突结束', e.status === 'LOST' ? '真实死亡已经结算，没有复活或奖励。' : e.status === 'RETREATED' ? '你从原出口实际退出，埃文和他的原短棍留在原处。本次禁令已结束，实际消耗与伤势保留，没有追逐或额外奖励。' : '抵抗结束，本次禁令已结束，原短棍仍归埃文。只有本人存活且实际有效参战才给予一次单项掌握25，不增加扮演，不治疗，不补灵性。');
}
