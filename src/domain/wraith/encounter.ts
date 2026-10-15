import type { SliceCombatRound, SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const WRAITH_ENCOUNTER_STORY = '完成至少一项真实报告并实际关闭镜面、退出附身及收束原物后，可花1行动沿原通路走到原工坊独立日光净空外院。本作原创成年普通人贝文因场地预约误会持自己的原普通短棍在2米外抵抗；不是诺兰、哈伦或旧对手。双方实际可见，原地面净空，身后原普通出口畅通，没有旁人或追逐。本场没有登记第二反光端点，不能借室内练习镜跳。可普通澄清、沿原出口撤退，或承担共同伤势与死亡风险；短暂附身可以被抗拒排斥，成功也在当次动作内退出，残留一次迟疑为有限G，绝非永久控制或必胜。满月极度虚弱时不能开战。人物、现场与数值均为本作G。';
function practiceClosed(s: SliceState): boolean {
  const p = s.wraith.practice;
  return p.form === 'HUMAN' && p.node === 'ROOM' && p.host === 'SELF' && p.mirror === 'COVERED' &&
    p.flag === 'TABLE' && p.note !== 'WRITTEN' &&
    Object.values(s.wraith.cases).every(r => !r.contactOpen && r.status !== 'PREPARED') &&
    s.zombie.practice.body === 'NORMAL' && s.zombie.practice.cold !== 'ICED' && s.zombie.practice.spirit !== 'PRESENT' &&
    Object.values(s.zombie.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.wraith.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
export function blockWraithEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'chained' || s.progression.sequence !== 5) return '先成为被缚者途径的怨魂。';
  if (s.wraith.moon.pendingWeek !== null) return '本次满月正在极度虚弱，不能开战；先实际度过这次发作。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原工坊外院。';
  if (!practiceClosed(s) || s.wraith.encounter.staggerReady) return '先实际沿原镜面或原走廊返回、显形退出附身，并关闭原镜与收束接触和原物。';
  if (!reportsComplete(s)) return '先完成至少一项怨魂真实实践与报告。';
  if (s.wraith.encounter.status !== 'AVAILABLE') return '这次贝文原外院争议已有结果，不能重复开启或重新生成原敌。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.wraith.encounter.attemptWeek === s.week
    ? '本周已经交涉，贝文本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyWraithEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockWraithEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.wraith.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原工坊独立日光外院', '花费1行动沿原通路到达原外院。成年普通人贝文持自己的原普通短棍在2米外，双方实际可见，原地面净空，身后原出口畅通，没有旁人；没有移动贝文或他的原棍，室内两面练习镜仍留在原处。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('贝文自行让开原通路', '贝文听取真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有附身、改写意愿、扮演或掌握奖励，也不解除满月诅咒。');
    } else ctx.note('贝文仍然拒绝让路', '本次1行动已付，贝文本人的拒绝与原棍归属保留；可离开，下一真实周再普通澄清，或承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  e.lastPossessionRound = null; e.staggerReady = false;
  s.combat = { encounterId: 'WRAITH_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('贝文原外院的有限冲突', WRAITH_ENCOUNTER_STORY);
}
export function hasWraithDisputeOpponent(s: SliceState): boolean {
  const e = s.wraith?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'chained' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'WRAITH_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || s.wraith.moon.pendingWeek !== null ||
      !practiceClosed(s) || !reportsComplete(s) || typeof e.staggerReady !== 'boolean' ||
      (e.lastPossessionRound !== null && (!Number.isSafeInteger(e.lastPossessionRound) || e.lastPossessionRound < 1 || e.lastPossessionRound > c.round)) ||
      (e.staggerReady && e.lastPossessionRound !== c.round) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleWraithEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.wraith.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'WRAITH_DISPUTE') throw new Error('没有正在进行的贝文原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知怨魂冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || !practiceClosed(s) || e.staggerReady ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !c.lastRound ||
      c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(c.lastRound) ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && (i === c.lastRound!.round - 1 || r.retreat !== 'SUCCESS')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS'))) {
    throw new Error('结局与原回合、原身体结果或附身退出后的有限迟疑收束不一致，不能制造投降、死亡或奖励。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('wraith-dispute')) award('wraith-dispute', 25);
  s.combat = null;
  ctx.note('贝文原外院冲突结束', e.status === 'LOST'
    ? '玩家在原日光外院真实死亡，原身体与各自原物留在现场；附身已退出、迟疑结束，实付灵性不退回，不复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出，贝文和自己的原短棍留在原处；没有追逐、镜跳、拖带或夺棍。附身已退出、迟疑结束，实际消耗、原伤势与月相记录保留，没有奖励。'
    : outcome === 'ENEMY_DEAD' ? '成年普通人贝文在原外院真实死亡，原尸体与自己的原棍留在原处，不重新生成活人，不自动收集或吞食灵魂。伤势与死亡来自共同战盘；附身已退出、迟疑结束。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性、不解除满月诅咒。'
    : '贝文仍然活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变；附身早已退出，没有强迫投降，迟疑结束。本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性、不解除满月诅咒。');
}
/** Persisted boundaries contain only the recorded attempt, never an active host or delayed control. */
function recordedPossessions(s: SliceState, rounds: SliceCombatRound[]): boolean {
  let last: number | null = null;
  for (const r of rounds) for (const m of r.moves) {
    if (m.actor !== 'PLAYER' || !(m.label.startsWith('有限附身成功') || m.label.startsWith('有限附身失败'))) continue;
    if (last === r.round) return false;
    last = r.round;
  }
  return !s.wraith.encounter.staggerReady && s.wraith.encounter.lastPossessionRound === last;
}
export function validateWraithEncounter(s: SliceState): boolean {
  const e = s.wraith.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'wraith-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      typeof e.staggerReady !== 'boolean' || e.staggerReady ||
      (e.lastPossessionRound !== null && (!Number.isSafeInteger(e.lastPossessionRound) || e.lastPossessionRound < 1)) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const pristine = e.lastPossessionRound === null && !e.staggerReady;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && pristine;
  const promoted = s.progression.pathwayId === 'chained' && (s.progression.sequence===5||(s.progression.sequence===4||[3, 2].includes(s.progression.sequence!)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'WRAITH_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.wraith.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.wraith.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasWraithDisputeOpponent(s) && recordedPossessions(s, s.combatHistory.slice(e.startHistoryIndex!));
  if (c?.encounterId === 'WRAITH_DISPUTE') return false;
  if (e.startHistoryIndex === null) return pristine && (e.status === 'AVAILABLE' || (e.status === 'RESOLVED' && e.attemptWeek !== null));
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS')) || !recordedPossessions(s, own)) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}
