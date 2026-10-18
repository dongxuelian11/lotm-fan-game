import type { SliceCombatRound, SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const DESIRE_APOSTLE_ENCOUNTER_STORY = '完成至少一项真实报告并实际收束接触、原账册与原笔记后，可花1行动走到原指导室独立日光净空外院。本作原创成年普通看守费兰因场地预约误会，持自己的原普通短棍在2米外抵抗；他实际涨红脸、紧绷肩膀，并明确说自己为预约被占用而生气，构成本场强烈情绪入口，不推定所有对手都有此条件。双方身体实际可见，原地面净空，身后原出口畅通，没有旁人或追逐。费兰执行原普通寻找空当时会实际稳住情绪，此后不能凭空再次激怒。可普通澄清、沿原出口撤退或承担真实战斗伤势与死亡风险。人物、现场、数值、两轮种子窗口及短暂迟疑均为本作G。';
function practiceClosed(s: SliceState): boolean {
  const p = s.desireApostle.practice;
  return p.ledger === 'GUIDE' && p.note !== 'WRITTEN' && p.seed !== 'PLANTED' && p.emotion === 'CALM' &&
    Object.values(s.desireApostle.cases).every(r => !r.contactOpen && r.status !== 'PREPARED') &&
    s.demon.practice.body === 'NORMAL' && s.demon.practice.flame !== 'LIT' &&
    Object.values(s.demon.cases).every(r => !r.contactOpen && r.status !== 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.desireApostle.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
function noEffects(s: SliceState): boolean { return !s.desireApostle.encounter.seedPlanted && !s.desireApostle.encounter.staggerReady; }
export function blockDesireApostleEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'abyss' || s.progression.sequence !== 5) return '先成为深渊途径的欲望使徒。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原指导室外院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先实际结束有限接触、归还原账册、交出原笔记并等候本次练习种子窗口结束；旧身体与火焰也须收束。';
  if (!reportsComplete(s)) return '先完成至少一项欲望使徒真实实践与报告。';
  if (s.desireApostle.encounter.status !== 'AVAILABLE') return '这次费兰原外院争议已有结果，不能重复开启或重新生成原敌。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.desireApostle.encounter.attemptWeek === s.week
    ? '本周已经交涉，费兰本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyDesireApostleEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockDesireApostleEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.desireApostle.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原指导室日光净空外院', '花费1行动沿原通路到达原外院。成年普通看守费兰持自己的原普通短棍在2米外，日光下双方实际可见，身后原出口畅通，没有旁人；不移动费兰或他的原棍。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('费兰自行让开原通路', '费兰听取真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有情绪催化、改写意愿、扮演或掌握奖励。');
    } else ctx.note('费兰仍然拒绝让路', '本次1行动已付，费兰本人的拒绝与原棍归属保留；可离开，下一真实周再普通澄清，或承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  e.emotion = 'STRONG'; e.seedPlanted = false; e.lastSeedRound = null; e.staggerReady = false;
  s.combat = { encounterId: 'DESIRE_APOSTLE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('费兰当前实际愤怒的有限冲突', DESIRE_APOSTLE_ENCOUNTER_STORY);
}
export function hasDesireApostleDisputeOpponent(s: SliceState): boolean {
  const e = s.desireApostle?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'abyss' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'DESIRE_APOSTLE_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      !Number.isSafeInteger(s.revision) || s.revision < 0 || !Number.isSafeInteger(s.week) || s.week < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || !practiceClosed(s) || !reportsComplete(s) ||
      !['STRONG', 'CALM'].includes(e.emotion) || typeof e.seedPlanted !== 'boolean' || typeof e.staggerReady !== 'boolean' ||
      (e.lastSeedRound !== null && (!Number.isSafeInteger(e.lastSeedRound) || e.lastSeedRound < 1 || e.lastSeedRound > c.round)) ||
      (e.seedPlanted && (e.lastSeedRound === null || c.round - e.lastSeedRound > 1)) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleDesireApostleEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.desireApostle.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'DESIRE_APOSTLE_DISPUTE') throw new Error('没有正在进行的费兰原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知欲望使徒冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || !practiceClosed(s) || !noEffects(s) ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !c.lastRound ||
      c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(c.lastRound) ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && (i === c.lastRound!.round - 1 || r.retreat !== 'SUCCESS')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS'))) {
    throw new Error('结局与原回合、原身体结果或有限效果收束不一致，不能制造投降、死亡或奖励。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('desire-apostle-dispute')) award('desire-apostle-dispute', 25);
  s.combat = null;
  ctx.note('费兰原外院冲突结束', e.status === 'LOST'
    ? '玩家在原日光外院真实死亡，原身体与各自原物留在现场；种子与短暂迟疑已结束，实付灵性不退回，不复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出，费兰和自己的原短棍留在原处；没有追逐、瞬移、拖带或夺棍。种子与短暂迟疑已结束，实际消耗、旧负荷与原伤势保留，没有奖励。'
    : outcome === 'ENEMY_DEAD' ? '成年普通看守费兰在原外院真实死亡，原尸体与自己的原棍留在原处，不重新生成活人。情绪能力没有自动致死；伤势与死亡来自共同战盘。种子与迟疑结束，本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不补灵性。'
    : '费兰仍然活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变；情绪催化没有强迫投降。种子与迟疑结束，本人存活且有效参战只给予一次单项掌握25，不增加扮演、不治疗、不清除负荷或补灵性。');
}
/** Reconcile only this scene's recorded public actions, not hidden thoughts or an NPC simulation. */
function recordedEffects(s: SliceState, rounds: SliceCombatRound[], terminal: boolean): boolean {
  let emotion: 'STRONG' | 'CALM' = 'STRONG', planted = false, last: number | null = null;
  for (const r of rounds) {
    for (const move of r.moves) {
      if (move.actor === 'ENEMY' && move.label.startsWith('稳住情绪后寻找空当')) emotion = 'CALM';
      if (move.actor !== 'PLAYER') continue;
      if (move.label.startsWith('情绪埋种成功') || move.label.startsWith('情绪埋种失败')) {
        if (emotion !== 'STRONG' || planted || last === r.round) return false;
        last = r.round; planted = move.label.startsWith('情绪埋种成功');
      }
      if (move.label.startsWith('情绪催化成功') || move.label.startsWith('情绪催化失败')) {
        if (emotion !== 'STRONG' || !planted) return false;
        planted = false;
      }
    }
    if (planted && last !== null && r.round - last >= 1) planted = false;
  }
  if (terminal) planted = false;
  const e = s.desireApostle.encounter;
  return e.emotion === emotion && e.seedPlanted === planted && e.lastSeedRound === last && !e.staggerReady;
}
export function validateDesireApostleEncounter(s: SliceState): boolean {
  const e = s.desireApostle.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'desire-apostle-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !['STRONG', 'CALM'].includes(e.emotion) || typeof e.seedPlanted !== 'boolean' || typeof e.staggerReady !== 'boolean' ||
      (e.lastSeedRound !== null && (!Number.isSafeInteger(e.lastSeedRound) || e.lastSeedRound < 1)) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const pristine = e.emotion === 'CALM' && e.lastSeedRound === null && noEffects(s);
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && pristine;
  const promoted = s.progression.pathwayId === 'abyss' && (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'DESIRE_APOSTLE_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.desireApostle.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.desireApostle.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasDesireApostleDisputeOpponent(s) && recordedEffects(s, s.combatHistory.slice(e.startHistoryIndex!), false);
  if (c?.encounterId === 'DESIRE_APOSTLE_DISPUTE' || !noEffects(s)) return false;
  if (e.startHistoryIndex === null) return pristine && (e.status === 'AVAILABLE' || (e.status === 'RESOLVED' && e.attemptWeek !== null));
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS')) || !recordedEffects(s, own, true)) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}
