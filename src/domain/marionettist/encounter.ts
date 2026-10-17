import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasMarionettistOpenCapture, validateMarionettistPuppet } from './puppet.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const MARIONETTIST_ENCOUNTER_STORY = '完成至少一项真实和平报告后，可前往原俱乐部独立前院。成年普通持棍人多恩MM5-DORN因出入误会在2米外持自己的原普通短棍MM5-DORN-CLUB抵抗，原院净空，没有旁人；身后实际后门可退出，不是追逐，也不会拖带人物或物件。可普通交涉或承担真实战斗风险；只有真实战败后仍活着并停止抵抗的原人才能另试两段捕获，战死者不能秘偶化，绝不保证投降。院里原信台上的同一封MM5-NOTE已被8米清路另一端原收件台接受，可由真正已控的同一原身体实际步行递交后返回；没有奖励、新信或复制身体。场景、费用、数值与递信均为本作原创G。';
export function hasMarionettistOpenPractice(s: SliceState): boolean {
  return s.marionettist.ritual.location !== 'CLUB' || s.marionettist.ritual.singing ||
    Object.values(s.marionettist.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
export function blockMarionettistEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'diviner' || s.progression.sequence !== 5) return '先成为秘偶大师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原俱乐部前院。';
  if (hasMarionettistOpenPractice(s) || hasMarionettistOpenCapture(s)) return '先实际结束当前接触、准备或控制，再去原院。';
  if (Object.values(s.faceless.cases).some(r => r.contactOpen || r.status === 'PREPARED') || s.faceless.outfit.location === 'PLAYER') return '先结束旧排练并归还同一原道具服。';
  if (!Object.values(s.marionettist.cases).some(r => r.status === 'RESOLVED')) return '先完成一项秘偶大师和平实践与真实报告。';
  if (s.marionettist.encounter.status !== 'AVAILABLE' || s.marionettist.puppet.target !== null) return '本段前院争议已有结果，不能重复生成多恩或重刷投降。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.marionettist.encounter.attemptWeek === s.week ? '本周已经交涉，原拒绝保留；下一真实周可再次普通澄清。' : null;
}
export function applyMarionettistEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockMarionettistEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.marionettist.encounter; e.attemptWeek = s.week;
  ctx.note('实际走进原俱乐部前院', '花费1行动到达原净空院子。成年普通人多恩在2米外持自己唯一原棍抵抗；后门实际净空可退出，原信留在原台，没有免费秘偶或新物品。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('多恩自行让开原通路', '多恩听取实际报告与普通澄清后自行让路，仍然活着、持有自己的原棍。没有被捕获、失忆或强迫服从，也没有额外扮演或掌握奖励；和平三案无需杀人。');
    } else ctx.note('多恩仍然拒绝让路', '本次1行动已付，拒绝与原棍归属保留；可以离开，下一真实周再普通交涉，也可以选择真实战斗。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  // While fighting, these fields are the one and only bodily authority. There
  // is no second healthy Dorn in the puppet state waiting to replace this one.
  s.combat = { encounterId: 'MARIONETTIST_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原前院的真实有限冲突', MARIONETTIST_ENCOUNTER_STORY + '多恩自身灵性15，普通人没有魔法；原已点燃随身灯才有火源，原纸人、伤势、纸张与灵性照实继承。');
}
export function hasMarionettistDisputeOpponent(s: SliceState): boolean {
  const e = s.marionettist?.encounter, c = s.combat;
  return s.progression.pathwayId === 'diviner' && s.progression.sequence === 5 && s.status === 'ACTIVE' &&
    s.health > 0 && s.mind > 0 && s.activeEvent === null && s.world.city === 'BACKLUND' &&
    c !== null && c.encounterId === 'MARIONETTIST_DISPUTE' && c.enemyStatus === 'RESISTING' &&
    c.enemyHealth > 0 && c.enemyMind > 0 && e?.status === 'FIGHTING' && e.attemptWeek === s.week &&
    s.marionettist.puppet.target === null && !hasMarionettistOpenPractice(s) &&
    Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex! >= 0 &&
    e.startHistoryIndex! <= s.combatHistory.length && Object.values(s.marionettist.cases).some(r => r.status === 'RESOLVED');
}
export function settleMarionettistEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.marionettist.encounter, combat = s.combat;
  if (e.status !== 'FIGHTING' || !combat || combat.encounterId !== 'MARIONETTIST_DISPUTE') throw new Error('没有正在进行的秘偶大师原前院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知秘偶大师前院冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (s.marionettist.puppet.target !== null || e.startHistoryIndex === null || !combat.lastRound) throw new Error('原身体权威或真实末轮记录无效，不能创建第二个多恩。');
  if ((outcome === 'ENEMY_SURRENDERED' && (combat.enemyStatus !== 'SURRENDERED' || combat.enemyHealth <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (combat.enemyStatus !== 'DEAD' || combat.enemyHealth !== 0)) ||
      (outcome === 'RETREATED' && combat.lastRound.retreat !== 'SUCCESS') ||
      (outcome === 'PLAYER_DEAD' && s.health !== 0)) throw new Error('结局与原战斗身体结果不一致，不能改写死亡或制造投降。');
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const surrendered = outcome === 'ENEMY_SURRENDERED', dead = combat.enemyStatus === 'DEAD';
  const p = s.marionettist.puppet;
  p.target = { id: 'MM5-DORN', name: '多恩', nature: 'ADULT_ORDINARY_HUMAN',
    health: combat.enemyHealth, mind: combat.enemyMind, spirituality: 15,
    injuries: combat.enemyInjuries.map(injury => ({ ...injury })), injuryRisk: combat.enemyRisk,
    alive: !dead, status: dead ? 'DEAD' : surrendered ? 'SURRENDERED' : 'UNCONTROLLED', location: 'ORIGINAL_COURTYARD',
    source: { encounterId: 'MARIONETTIST_DISPUTE', startHistoryIndex: e.startHistoryIndex,
      settledRound: combat.lastRound.round, combatStatus: combat.enemyStatus },
    club: { id: 'MM5-DORN-CLUB', ownerId: 'MM5-DORN', location: surrendered || dead ? 'COURTYARD_GROUND' : 'DORN_HAND' } };
  p.ownerDistanceMetres = surrendered ? 2 : null;
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective) award('marionettist-dispute', 25);
  s.magician.lantern.prepared = false; s.combat = null;
  ctx.note('原前院真实冲突结束', e.status === 'LOST' ? '玩家真实死亡已结算；多恩的原身体状态与原棍保留，没有复活、秘偶或奖励。'
    : e.status === 'RETREATED' ? '你沿原后门实际退出，没有进入追逐、拖带多恩或拿走他的原棍；双方原伤势与消耗保留，不能再开本次冲突。'
    : dead ? '多恩在原战斗中真正死亡；同一原尸体与原棍留在院子，原伤势与结果保留。死人没有灵体之线，不能捕获，不会重新生成活人。'
    : '多恩仍活着，在2米处自行停止抵抗并放下同一原棍。原战后健康、精神、伤势与自身15灵性转入同一原身体记录；尚无秘偶。可0行动释放原人，或另花成本尝试约20秒初控；继续约280秒完整转化还需单独确认死亡，没有保证成功或投降。');
}
export function validateMarionettistEncounter(s: SliceState): boolean {
  const e = s.marionettist.encounter, p = s.marionettist.puppet, c = s.combat;
  if (!validateMarionettistPuppet(p)) return false;
  if (e.status === 'FIGHTING') return c?.encounterId === 'MARIONETTIST_DISPUTE' && p.target === null &&
    e.startHistoryIndex !== null && e.startHistoryIndex <= s.combatHistory.length &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && e.attemptWeek === s.week;
  if (c?.encounterId === 'MARIONETTIST_DISPUTE') return false;
  if (hasMarionettistOpenCapture(s) && (s.status !== 'ACTIVE' || s.health <= 0 || s.activeEvent !== null || c !== null ||
      s.world.city !== 'BACKLUND' || e.attemptWeek !== s.week || hasMarionettistOpenPractice(s))) return false;
  if (e.startHistoryIndex === null) return p.target === null && ['AVAILABLE', 'RESOLVED'].includes(e.status);
  const t = p.target;
  if (!t || t.source.startHistoryIndex !== e.startHistoryIndex || e.startHistoryIndex >= s.combatHistory.length ||
      e.attemptWeek === null || e.attemptWeek > s.week ||
      s.combatHistory.length - e.startHistoryIndex < t.source.settledRound ||
      (p.capture.startedWeek !== null && p.capture.startedWeek !== e.attemptWeek)) return false;
  const terminal = s.combatHistory[e.startHistoryIndex + t.source.settledRound - 1];
  if (!terminal || terminal.round !== t.source.settledRound ||
      !s.combatHistory.slice(e.startHistoryIndex, e.startHistoryIndex + t.source.settledRound).every((r, i) =>
        r.round === i + 1 && r.winner !== null && (i === t.source.settledRound - 1 || r.retreat !== 'SUCCESS'))) return false;
  if (e.status === 'RETREATED') return t.status === 'UNCONTROLLED' && terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return t.status === 'UNCONTROLLED' && terminal.winner === 'ENEMY';
  return e.status === 'RESOLVED' && t.source.combatStatus !== 'RESISTING' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}
