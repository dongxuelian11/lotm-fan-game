import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { GUARDIAN_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const GUARDIAN_ENCOUNTER_STORY = '完成至少一项真实报告、停止原探针、放下守护架势并让原同伴实际退回等待处后，可花1行动前往原训练场独立净空外院。原创成年普通外院看门人埃德温因场地安排误会，在2米外持自己的原普通短棍抵抗；原身体清楚可见，原地面净空，身后实际原出口可退出，没有旁人、同伴或追逐。可以普通交涉；开战不预送晨曦剑或光甲，原物权不变。选择防御代表本整轮放弃攻击，足够时开轮付3灵性并采用强守护；不足仍不攻击。迎战则降低防御。此处没有可分担的同伴伤害，也没有幻象或神圣易伤；人物、场景、距离、成本与数值为G。';

export function hasGuardianOpenPractice(s: SliceState): boolean {
  const p = s.guardian.practice;
  return p.guardActive || p.allyPresent || p.allyDistance !== null ||
    Object.values(s.guardian.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.dawnPaladin.practice.swordActive || s.dawnPaladin.practice.armorActive ||
    Object.values(s.dawnPaladin.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return GUARDIAN_CASE_IDS.some(id => {
    const r = s.guardian.cases[id];
    return r?.status === 'RESOLVED' && r.contactOpen === false && r.closes >= 1;
  });
}
function noGear(s: SliceState): boolean {
  const e = s.guardian.encounter;
  return e.swordReady === false && e.swordLostRound === null && e.armorReady === false && e.armorExpiresRound === null;
}
function liveGearValid(s: SliceState): boolean {
  const e = s.guardian.encounter, c = s.combat;
  if (!c || typeof e.swordReady !== 'boolean' || typeof e.armorReady !== 'boolean' ||
      (e.swordReady && (s.town.clubLocation === 'HAND' || s.warrior.practiceClub.location === 'player:hand'))) return false;
  if (e.swordLostRound !== null && (!Number.isSafeInteger(e.swordLostRound) || e.swordLostRound < 1 ||
      e.swordLostRound > c.round || (e.swordReady && e.swordLostRound === c.round))) return false;
  return e.armorReady ? e.armorExpiresRound !== null && Number.isSafeInteger(e.armorExpiresRound) &&
    e.armorExpiresRound >= c.round && e.armorExpiresRound <= c.round + 1 : e.armorExpiresRound === null;
}
export function blockGuardianEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'warrior' || s.progression.sequence !== 5) return '先成为守护者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原训练场外院。';
  if (hasGuardianOpenPractice(s)) return '先停止原探针、解除架势、让同伴实际退回原等待处，结束日常接触或取消准备。';
  if (!reportsComplete(s)) return '先完成至少一项守护者真实实践与报告。';
  if (s.guardian.encounter.status !== 'AVAILABLE') return '本段外院争议已有结果，不能重新生成埃德温或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.guardian.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyGuardianEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockGuardianEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.guardian.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原训练场外院', '花费1行动到达原独立净空外院。成年普通看门人埃德温在2米外可见并持自己的原普通短棍；原地面净空、身后原出口可退出，没有旁人、同伴或追逐。各自原物归属与实际位置不变，不补灵性，不把日常同伴带入。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('埃德温自行让开原通路', '成年普通看门人埃德温听取真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有强迫服从，没有额外扮演或掌握奖励。');
    } else ctx.note('埃德温仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  e.swordReady = false; e.swordLostRound = null; e.armorReady = false; e.armorExpiresRound = null;
  s.combat = { encounterId: 'GUARDIAN_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原训练场外院的有限冲突', GUARDIAN_ENCOUNTER_STORY);
}
export function hasGuardianDisputeOpponent(s: SliceState): boolean {
  const e = s.guardian?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'warrior' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'GUARDIAN_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasGuardianOpenPractice(s) || !liveGearValid(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleGuardianEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.guardian.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'GUARDIAN_DISPUTE') throw new Error('没有正在进行的守护者原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知守护者冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasGuardianOpenPractice(s) ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !c.lastRound ||
      c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(c.lastRound) ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && (r === s.combatHistory.at(-1) || r.retreat !== 'SUCCESS')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE' || c.lastRound.stance === 'DEFEND')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE' || c.lastRound.stance === 'DEFEND')) ||
      (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS'))) {
    throw new Error('结局与原回合或身体结果不一致，不能制造投降、改写死亡或发放奖励。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('guardian-dispute')) award('guardian-dispute', 25);
  e.swordReady = false; e.swordLostRound = null; e.armorReady = false; e.armorExpiresRound = null;
  s.combat = null;
  ctx.note('原外院真实冲突结束', e.status === 'LOST' ? '玩家在原外院与成年普通看门人埃德温的真实冲突中死亡，原尸体、各自原物与实付灵性保留；守护没有复活、补血或奖励。'
    : e.status === 'RETREATED' ? '你沿原外院的实际原出口退出，没有瞬移、追逐、拖带埃德温或拿走他的原棍；原伤势与消耗保留，临时剑甲清除，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '成年普通看门人埃德温在原战斗中真实死亡，原尸体和自己的原棍留在原外院，不重新生成活人。有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '成年普通看门人埃德温仍活着，在原外院自行停止抵抗并放下自己的原短棍，原棍归属不变；有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateGuardianEncounter(s: SliceState): boolean {
  const e = s.guardian.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'guardian-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && noGear(s);
  const promoted = s.progression.pathwayId === 'warrior' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'GUARDIAN_DISPUTE';
  if (!initial && (!reportsComplete(s) || s.guardian.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.guardian.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasGuardianDisputeOpponent(s);
  if (c?.encounterId === 'GUARDIAN_DISPUTE' || !noGear(s)) return false;
  if (e.startHistoryIndex === null) return e.status === 'AVAILABLE' || (e.status === 'RESOLVED' && e.attemptWeek !== null);
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS'))) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE' && terminal.stance !== 'DEFEND';
}
