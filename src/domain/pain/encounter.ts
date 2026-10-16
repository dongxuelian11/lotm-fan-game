import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PAIN_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'ENCOUNTER_AID' };
export const PAIN_ENCOUNTER_STORY = '完成至少一项普通演练报告且所有原人、原物实际收束后，可花1行动前往独立练习场的原净空外院。原创成年普通看守奥伦因场地安排误会，在2米外持自己的原普通短棍抵抗；双方原身体可见、原地面净空、身后原出口可退出，没有旁人、同伴或追逐。本场奥伦不是旧欢愉外院马伦，也不借用其他场景同名人物。可以普通交涉而不施病。真实冲突的疾病为有限超自然强度：首次4灵性与知识14，后续每轮2灵性维持，最高3；防御明确停止新暴露，但已患疾病不会随停场或离开治愈。无友军自动免疫保证，本场无人只是实际现场事实；丝线须本场先布丝、后牵引，每步3灵性。人物、场景、距离、轮数、成本与数值均为G。';

export function hasPainOpenPractice(s: SliceState): boolean {
  const p = s.pain.practice;
  return p.playerNode !== 'ENTRY' || p.companionNode !== 'WAITING' || p.marker !== 'RACK' ||
    Object.values(s.pain.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.pleasure.practice.wrist !== 'FREE' || s.pleasure.practice.fireSilk === 'ON_FRAME' ||
    s.pleasure.practice.fireSilk === 'BROKEN' ||
    Object.values(s.pleasure.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return PAIN_CASE_IDS.some(id => {
    const r = s.pain.cases[id];
    return r?.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1;
  });
}
function validDisease(s: SliceState): boolean {
  const e = s.pain.encounter;
  const keys = ['status', 'startHistoryIndex', 'attemptWeek', 'silkPrepared', 'boundRound', 'fieldActive',
    'enemyDisease', 'diseaseApplications', 'lastDiseaseRound', 'care', 'enemyHealth', 'enemyStatus'];
  return e !== null && typeof e === 'object' && Object.keys(e).length === keys.length &&
    keys.every(key => Object.hasOwn(e, key)) && typeof e.silkPrepared === 'boolean' && typeof e.fieldActive === 'boolean' &&
    Number.isSafeInteger(e.enemyDisease) && e.enemyDisease >= 0 && e.enemyDisease <= 3 &&
    Number.isSafeInteger(e.diseaseApplications) && e.diseaseApplications >= 0 && e.diseaseApplications <= 1 &&
    ((e.enemyDisease === 0) === (e.diseaseApplications === 0)) &&
    (e.enemyDisease === 0 ? e.lastDiseaseRound === null && !e.fieldActive
      : e.lastDiseaseRound !== null && Number.isSafeInteger(e.lastDiseaseRound) && e.lastDiseaseRound >= 1) &&
    Number.isSafeInteger(e.enemyHealth) && e.enemyHealth >= 0 && e.enemyHealth <= 100 &&
    ['NOT_MET', 'RESISTING', 'SURRENDERED', 'DEAD', 'LEFT'].includes(e.enemyStatus) &&
    ((e.enemyStatus === 'DEAD') === (e.enemyHealth === 0)) && ['NONE', 'REQUESTED'].includes(e.care);
}
function noExposure(s: SliceState): boolean {
  const e = s.pain.encounter;
  return !e.fieldActive && e.enemyDisease === 0 && e.diseaseApplications === 0 && e.lastDiseaseRound === null &&
    !e.silkPrepared && e.boundRound === null && e.care === 'NONE' && e.enemyHealth === 100;
}
export function blockPainEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神；死亡者不能请求协助。';
  if (s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 5) return '先成为痛苦魔女。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原独立练习场外院。';
  if (hasPainOpenPractice(s)) return '先结束普通演练、按原路线回位并收回原标记，解除旧丝线或接触。';
  if (!reportsComplete(s)) return '先完成至少一项痛苦魔女普通演练与报告。';
  const e = s.pain.encounter;
  if (c.type === 'ENCOUNTER_AID') {
    if (!validatePainEncounter(s) || !['RESOLVED', 'RETREATED'].includes(e.status) || e.startHistoryIndex === null ||
        e.fieldActive || e.enemyHealth <= 0 || e.enemyStatus === 'DEAD' || e.enemyDisease <= 0) return '只能在原冲突结束后，为实际暴露且仍活着的同一原奥伦请求协助。';
    if (e.care !== 'NONE') return '已经为同一原奥伦请求协助；不重复收费，也不冒称治愈。';
    if (!Number.isFinite(s.cash) || s.cash < 40) return '请求传话与车马协助需要40便士。';
  } else {
    if (e.status !== 'AVAILABLE' || !noExposure(s) || e.startHistoryIndex !== null) return '本段原外院冲突已有结果，不能再生成活人、清除疾病或重复开启。';
    if (c.type === 'ENCOUNTER_TALK' && e.attemptWeek === s.week) return '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。';
  }
  return s.actionsRemaining < 1 ? '本次选择需要1行动。' : null;
}
export function applyPainEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockPainEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.pain.encounter;
  s.actionsRemaining -= 1;
  if (c.type === 'ENCOUNTER_AID') {
    s.cash -= 40; e.care = 'REQUESTED';
    ctx.note('已实际请求原奥伦所需协助', `支付1行动与40便士，在停止疾病场并退出接触后，实际传话请求为原奥伦安排车马与照护协助。只是已请求，不保证到达或治愈；原健康${e.enemyHealth}、疾病强度${e.enemyDisease}、暴露次数${e.diseaseApplications}均不变。未诊断、喂药、恢复健康或消除疾病。`);
    return;
  }
  e.attemptWeek = s.week; e.enemyStatus = 'RESISTING';
  ctx.note('实际走到原净空外院', '支付1行动，来到本段原独立外院。成年普通奥伦在2米外清楚可见，持自己的原普通短棍；原地面净空、身后原出口实际可退，没有旁人、同伴或追逐，不借用旧马伦或旧丝线。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED'; e.enemyStatus = 'LEFT';
      ctx.note('奥伦自行让开原通路', '奥伦听取普通澄清后自行让路，仍活着并持有自己的原棍；没有施病、强制服从、额外扮演或掌握奖励。');
    } else ctx.note('奥伦仍拒绝让路', '本人拒绝与原短棍归属保留；本次1行动已付，可以离开，下周再澄清或承担真实冲突风险。没有造成疾病。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  // First and only actual encounter. Existing exposure cannot enter this branch.
  s.combat = { encounterId: 'PAIN_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原净空外院的有限冲突', PAIN_ENCOUNTER_STORY);
}
export function hasPainDisputeOpponent(s: SliceState): boolean {
  const e = s.pain?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 5 || !e || !validDisease(s) ||
      s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'PAIN_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || e.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      e.enemyHealth !== c.enemyHealth || !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 ||
      !Number.isSafeInteger(c.round) || c.round < 1 || e.status !== 'FIGHTING' || e.attemptWeek !== s.week ||
      e.care !== 'NONE' || hasPainOpenPractice(s) || !reportsComplete(s) ||
      (e.boundRound !== null && e.boundRound !== c.round) || (e.lastDiseaseRound !== null && e.lastDiseaseRound > c.round) ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1) return false;
  const last = s.combatHistory.at(-1);
  if (c.round > 1 && last?.painOutcome?.enemyHealth !== e.enemyHealth) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null &&
    r.retreat !== 'SUCCESS' && r.painOutcome?.enemyStatus === 'RESISTING' && r.painOutcome.enemyHealth > 0 &&
    r.painOutcome.enemyDisease <= e.enemyDisease && r.painOutcome.diseaseApplications <= e.diseaseApplications);
}
export function settlePainEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.pain.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'PAIN_DISPUTE') throw new Error('没有正在进行的痛苦魔女原外院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知痛苦魔女冲突结果。');
  if (outcome === 'CONTINUE') return;
  const r = c.lastRound;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasPainOpenPractice(s) || e.startHistoryIndex === null ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !r || c.round !== r.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== r.round || JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(r) ||
      !r.painOutcome || r.painOutcome.enemyHealth !== c.enemyHealth || r.painOutcome.enemyStatus !== c.enemyStatus ||
      r.painOutcome.enemyDisease !== e.enemyDisease || r.painOutcome.diseaseApplications !== e.diseaseApplications ||
      e.enemyHealth !== c.enemyHealth || e.enemyStatus !== c.enemyStatus || e.fieldActive || e.silkPrepared || e.boundRound !== null ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || r.winner !== 'PLAYER' || r.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || r.winner !== 'PLAYER' || r.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (r.retreat !== 'SUCCESS' || r.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || r.winner !== 'ENEMY' || r.retreat === 'SUCCESS'))) {
    throw new Error('结局必须对应真实原回合、原敌健康与持续疾病，不能制造投降、改写死亡或清除暴露。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(round => round.retreat === 'NONE' &&
    round.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('pain-dispute')) award('pain-dispute', 25);
  s.combat = null;
  ctx.note('原奥伦冲突结束', e.status === 'LOST' ? '玩家真实死亡，疾病场因无法维持停止；原奥伦实际身体结果与疾病保留，没有复活或奖励。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出；原奥伦和自有原棍留在原处，无追逐、夺棍或瞬移。已停止新增暴露，已有疾病、健康与实付资源不变，没有奖励，不能重开本场。'
    : outcome === 'ENEMY_DEAD' ? '同一原奥伦真实死亡，原尸体与自有原棍留在现场；不再生成活人，不补血、不返还灵性，有效参战只奖励一次单项掌握25。'
    : '同一原奥伦仍活着，自行停止抵抗并放下自有原棍；原棍归属、伤势与疾病保留。有效参战只奖励一次单项掌握25，不加扮演、不治愈；实际暴露者可另行请求协助。');
}
export function validatePainEncounter(s: SliceState): boolean {
  const e = s.pain.encounter, c = s.combat;
  if (!validDisease(s) || !Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'pain-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null && noExposure(s) && e.enemyStatus === 'NOT_MET';
  const promoted = s.progression.pathwayId === 'demoness' && (s.progression.sequence === 5||s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'PAIN_DISPUTE';
  if (initial) return rewards === 0 && c?.encounterId !== 'PAIN_DISPUTE';
  if (!reportsComplete(s) || s.pain.promotionWeek === null || e.attemptWeek === null || e.attemptWeek < s.pain.promotionWeek) return false;
  if (e.status === 'FIGHTING') return rewards === 0 && hasPainDisputeOpponent(s);
  if (c?.encounterId === 'PAIN_DISPUTE' || e.fieldActive || e.silkPrepared || e.boundRound !== null) return false;
  if (e.startHistoryIndex === null) return rewards === 0 && noExposure(s) &&
    ((e.status === 'AVAILABLE' && e.enemyStatus === 'RESISTING') || (e.status === 'RESOLVED' && e.enemyStatus === 'LEFT'));
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && r.painOutcome &&
      (i === own.length - 1 || r.retreat !== 'SUCCESS' && r.painOutcome.enemyStatus === 'RESISTING') &&
      r.painOutcome.enemyDisease <= e.enemyDisease && r.painOutcome.diseaseApplications <= e.diseaseApplications &&
      (i === 0 || r.painOutcome.enemyDisease >= own[i - 1]!.painOutcome!.enemyDisease &&
        r.painOutcome.enemyHealth <= own[i - 1]!.painOutcome!.enemyHealth))) return false;
  if (!terminal.painOutcome || terminal.painOutcome.enemyHealth !== e.enemyHealth || terminal.painOutcome.enemyStatus !== e.enemyStatus ||
      terminal.painOutcome.enemyDisease !== e.enemyDisease || terminal.painOutcome.diseaseApplications !== e.diseaseApplications ||
      (e.lastDiseaseRound !== null && e.lastDiseaseRound > terminal.round)) return false;
  if (e.care === 'REQUESTED' && (!['RESOLVED', 'RETREATED'].includes(e.status) || e.enemyDisease === 0 || e.enemyHealth <= 0)) return false;
  if (rewards && (e.status !== 'RESOLVED' || !own.some(r => r.retreat === 'NONE' &&
      r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0))))) return false;
  if (e.status === 'RETREATED') return rewards === 0 && terminal.retreat === 'SUCCESS' && e.enemyStatus === 'RESISTING';
  if (e.status === 'LOST') return rewards === 0 && terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE' &&
    (e.enemyStatus === 'DEAD' || e.enemyStatus === 'SURRENDERED');
}
