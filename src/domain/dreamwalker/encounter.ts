import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const DREAMWALKER_ENCOUNTER_STORY = '完成至少一项真实和平报告后，可实际前往原会所净空后庭。成年普通来访者马斯因出入误会，在2米外持自己的唯一普通原短棍抵抗。他当前清醒，现场没有可进入的睡眠者或梦境，也没有第二个智慧生物的梦境端点；不能把清醒者直接拖进梦、凭空造梦牢或梦境瞬移。身后原出口可退出，不是追逐，不拖带人物或夺走原棍。可普通交涉或承担真实战斗风险；继承的心理医生与催眠师能力仍有限、可抵抗，不命令自杀，不删除对手行动，也不预先获得操纵师的人格或精神瘟疫。场景与数值是本作原创G。';

export function hasDreamwalkerOpenPractice(s: SliceState): boolean {
  return s.dreamwalker.ritual.activeVisitId !== null || s.dreamwalker.ritual.featherHolder !== 'LINGWEI' ||
    s.dreamwalker.practice.location !== 'SOURCE_ROOM' || s.dreamwalker.practice.dream !== 'NONE' ||
    s.dreamwalker.practice.outboundTrips !== s.dreamwalker.practice.returns ||
    Object.values(s.dreamwalker.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    Object.values(s.hypnotist.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
export function blockDreamwalkerEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 5) return '先成为梦境行者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原会所后庭。';
  if (hasDreamwalkerOpenPractice(s)) return '先实际结束当前接触与仪式、归还原羽，并从梦中退出、返回源房间，再前往后庭。';
  if (!Object.values(s.dreamwalker.cases).some(r => r.status === 'RESOLVED')) return '先完成一项梦境行者和平实践与真实报告。';
  if (s.dreamwalker.encounter.status !== 'AVAILABLE') return '本段后庭争议已有结果，不能再生成马斯或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.dreamwalker.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyDreamwalkerEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockDreamwalkerEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.dreamwalker.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原会所后庭', '花费1行动到达原净空后庭。清醒的成年普通人马斯在2米外持自己的原普通短棍；原出口可退出。没有睡眠者、现成梦境、梦境端点或新增装备。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('马斯自行让开原通路', '马斯听取真实报告与普通澄清后自行让路，仍清醒、活着并持有自己的原棍；没有强迫服从，没有额外扮演或掌握奖励。');
    } else ctx.note('马斯仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可以离开，下一真实周再普通交涉，或选择真实战斗。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DREAMWALKER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原后庭的有限冲突', DREAMWALKER_ENCOUNTER_STORY);
}
/** The original awake person, exact week and current contiguous round segment. */
export function hasDreamwalkerDisputeOpponent(s: SliceState): boolean {
  const e = s.dreamwalker?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'DREAMWALKER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasDreamwalkerOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 ||
      !Object.values(s.dreamwalker.cases).some(r => r.status === 'RESOLVED')) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleDreamwalkerEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.dreamwalker.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'DREAMWALKER_DISPUTE') throw new Error('没有正在进行的梦境行者原后庭冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知梦境行者冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound ||
      s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      s.combatHistory.at(-1)?.round !== c.lastRound.round ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER')) ||
      (outcome === 'RETREATED' && c.lastRound.retreat !== 'SUCCESS') ||
      (outcome === 'PLAYER_DEAD' && s.health !== 0)) throw new Error('结局与原回合或身体结果不一致，不能制造投降、改写死亡或发放奖励。');
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('dreamwalker-dispute', 25);
  s.combat = null;
  ctx.note('原后庭真实冲突结束', e.status === 'LOST' ? '玩家真实死亡已经结算，没有复活或奖励；原结果保留。'
    : e.status === 'RETREATED' ? '你沿原出口实际退出，没有梦境瞬移、追逐、拖带马斯或拿走他的原棍；原伤势与消耗保留，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '马斯在原战斗中真实死亡，原尸体与自己的原棍留在后庭，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '马斯仍活着，自行停止抵抗并放下自己的原普通短棍。原棍归属不变，没有被催眠强制投降或成为受控者；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateDreamwalkerEncounter(s: SliceState): boolean {
  const e = s.dreamwalker.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'dreamwalker-dispute').length;
  if (rewards > 1) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'audience' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'DREAMWALKER_DISPUTE';
  if (!initial && (!Object.values(s.dreamwalker.cases).some(r => r.status === 'RESOLVED') ||
      s.dreamwalker.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.dreamwalker.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (!['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  if (e.status === 'FIGHTING') return hasDreamwalkerDisputeOpponent(s);
  if (c?.encounterId === 'DREAMWALKER_DISPUTE') return false;
  if (e.startHistoryIndex === null) return e.status === 'AVAILABLE' || (e.status === 'RESOLVED' && e.attemptWeek !== null);
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length ||
      e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex);
  const next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS'))) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' &&
      r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}
