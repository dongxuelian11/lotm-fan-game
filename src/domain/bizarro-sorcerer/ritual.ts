import { hasMarionettistOpenPractice } from '../marionettist/encounter.js';
import { hasMarionettistOpenCapture } from '../marionettist/puppet.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { BizarroSorcererAction } from './types.js';

/** Original G scene and quantities. The canon requirement is a real, publicly
 * witnessed, primarily self-powered dramatic murder and drinking at its finale. */
export const BIZARRO_WITNESS_ROSTER = Object.freeze(Array.from({ length: 36 }, (_, n) => Object.freeze({ id: `B4-ADULT-WITNESS-${n + 1}`, groupId: `B4-STONE-TIER-${Math.floor(n / 12) + 1}`, age: 24 + n, nature: 'LIVING_ADULT_HUMAN' as const })));
export const BIZARRO_WITNESS_IDS: readonly string[] = Object.freeze(BIZARRO_WITNESS_ROSTER.map(w => w.id));
export type BizarroRitualPhase = 'UNSEEN' | 'SURVEYED' | 'PREPARED' | 'ASSEMBLED' | 'FIGHTING' | 'FINALE' | 'CLOSED' | 'LOST';
export interface BizarroTarget {
  id: string; name: string; siteId: string; originalBellId: string; source: string;
  status: 'UNSURVEYED' | 'AVAILABLE' | 'ENGAGED' | 'DEAD' | 'LEFT_ALIVE'; surveyedWeek: number | null;
  terminalBody: null | { health: number; mind: number; spirituality: number; injuries: SliceInjury[]; risk: number; status: 'DEAD' | 'RESISTING' };
}
export interface BizarroKillEvidence { targetId: string; equivalentSequence: 4; attemptId: string; terminalHistoryIndex: number; killer: 'PLAYER' }
export interface BizarroRitualAttempt {
  id: string; targetId: string; mode: 'RITUAL' | 'CHALLENGE'; bottleId: string | null; week: number;
  startHistoryIndex: number; terminalHistoryIndex: number | null; closedWeek: number | null;
  playerAttackCount: number; arrivedWitnessIds: string[]; deathWitnessIds: string[];
  opening: { illusionUsed: boolean; flameJumpUsed: boolean }; invalidReason: string | null;
  killEvidence: BizarroKillEvidence | null; consumedBottleId: string | null;
  outcome: 'FIGHTING' | 'FINALE' | 'ENEMY_DEAD' | 'RETREATED' | 'PLAYER_DEAD' | 'CONSUMED' | 'ABANDONED';
}
export interface BizarroRitualState {
  phase: BizarroRitualPhase; mode: 'RITUAL' | 'CHALLENGE'; currentTargetId: string | null;
  preparedWeek: number | null; visitWeek: number | null; earliestSurveyWeek: number;
  attemptId: string | null; bottleId: string | null; startHistoryIndex: number | null;
  witnesses: { invitedIds: string[]; presentIds: string[]; exitedIds: string[]; arrivedWeek: number | null;
    sightlineVerified: boolean; viewObstructed: boolean; unsafe: boolean; dismissed: boolean };
  opening: { illusionUsed: boolean; flameJumpUsed: boolean }; enemySpirituality: number; veil: boolean;
  invalidReason: string | null; killEvidence: BizarroKillEvidence | null; consumedBottleId: string | null;
  targets: BizarroTarget[]; attempts: BizarroRitualAttempt[];
  leadOrdinal: number; leadRequestedWeek: number | null;
  pendingLead: null | { id: string; targetId: string; source: string; siteId: string; originalBellId: string; receivedWeek: number };
}
export type BizarroRitualCommand =
  | { type: 'SURVEY_RITUAL'; targetId: string } | { type: 'PREPARE_STAGE' } | { type: 'GATHER_WITNESSES' }
  | { type: 'START_RITUAL'; bottleId: string; confirmed: true } | { type: 'CLOSE_RITUAL' }
  | { type: 'REQUEST_NEXT_RITUAL'; targetId: string } | { type: 'REQUEST_NEW_LEAD' } | { type: 'RECEIVE_LEAD' }
  | { type: 'START_CHALLENGE'; targetId: string; confirmed: true };
const emptyWitnesses = (): BizarroRitualState['witnesses'] => ({ invitedIds: [], presentIds: [], exitedIds: [], arrivedWeek: null,
  sightlineVerified: false, viewObstructed: false, unsafe: false, dismissed: false });
export function createBizarroRitualState(): BizarroRitualState {
  return { phase: 'UNSEEN', mode: 'RITUAL', currentTargetId: null, preparedWeek: null, visitWeek: null,
    earliestSurveyWeek: 0, attemptId: null, bottleId: null, startHistoryIndex: null, witnesses: emptyWitnesses(),
    opening: { illusionUsed: false, flameJumpUsed: false }, enemySpirituality: 0, veil: false,
    invalidReason: null, killEvidence: null, consumedBottleId: null, targets: ['A', 'B', 'C'].map((letter, i) => ({
      id: `B4-COPPER-BELL-${letter}`, name: `铜钟帷幕兽${['甲', '乙', '丙'][i]}`, siteId: `B4-OLD-SOUND-COURT-${letter}`,
      originalBellId: `B4-ORIGINAL-BELL-${letter}`, source: '旧铸钟场登记册：三个相隔60米、各有原铜钟与原石槽的废试音院；须本人现场核实',
      status: 'UNSURVEYED', surveyedWeek: null, terminalBody: null })), attempts: [], leadOrdinal: 0,
    leadRequestedWeek: null, pendingLead: null };
}
export function validateBizarroRitualCommand(value: unknown): value is BizarroRitualCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  const types = ['SURVEY_RITUAL', 'PREPARE_STAGE', 'GATHER_WITNESSES', 'START_RITUAL', 'CLOSE_RITUAL', 'REQUEST_NEXT_RITUAL', 'REQUEST_NEW_LEAD', 'RECEIVE_LEAD', 'START_CHALLENGE'];
  if (!types.includes(String(c.type))) return false;
  const keys = ['type'];
  if (['SURVEY_RITUAL', 'REQUEST_NEXT_RITUAL', 'START_CHALLENGE'].includes(String(c.type))) {
    if (typeof c.targetId !== 'string' || !c.targetId.length || c.targetId.length > 240) return false;
    keys.push('targetId');
  }
  if (c.type === 'START_RITUAL') { if (typeof c.bottleId !== 'string' || !c.bottleId.length) return false; keys.push('bottleId'); }
  if (c.type === 'START_RITUAL' || c.type === 'START_CHALLENGE') { if (c.confirmed !== true) return false; keys.push('confirmed'); }
  return Object.keys(c).every(k => keys.includes(k));
}
export function hasBizarroRitualLock(s: SliceState): boolean { return ['ASSEMBLED', 'FIGHTING', 'FINALE'].includes(s.bizarroSorcerer.ritual.phase); }
export function currentBizarroAttempt(s: SliceState): BizarroRitualAttempt | null {
  const r = s.bizarroSorcerer.ritual; return r.attempts.find(a => a.id === r.attemptId) ?? null;
}
export function hasBizarroRitualOpponent(s: SliceState): boolean {
  const r = s.bizarroSorcerer?.ritual, c = s.combat;
  if (!r || !c || c.encounterId !== 'BIZARRO_RITUAL' || c.enemyStatus !== 'RESISTING' || c.enemyHealth <= 0 || c.enemyMind <= 0 ||
      s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      s.progression.pathwayId !== 'diviner' || ![5, 4].includes(s.progression.sequence ?? 0) || r.phase !== 'FIGHTING' ||
      r.visitWeek !== s.week || r.startHistoryIndex === null || s.combatHistory.length - r.startHistoryIndex !== c.round - 1) return false;
  const a = currentBizarroAttempt(s), t = r.targets.find(t => t.id === r.currentTargetId);
  return !!a && !!t && a.outcome === 'FIGHTING' && a.targetId === t.id && t.status === 'ENGAGED' && t.terminalBody === null &&
    a.week === s.week && a.startHistoryIndex === r.startHistoryIndex && t.surveyedWeek !== null &&
    r.enemySpirituality >= 0 && r.enemySpirituality <= 40 &&
    ((r.mode === 'RITUAL' && s.progression.sequence === 5) || (r.mode === 'CHALLENGE' && s.progression.sequence === 4)) &&
    s.combatHistory.slice(r.startHistoryIndex).every((h, i) => h.round === i + 1 && h.winner !== null && h.retreat !== 'SUCCESS');
}
function audiencePresent(r: BizarroRitualState): boolean {
  return !r.invalidReason && r.witnesses.sightlineVerified && !r.witnesses.viewObstructed && !r.witnesses.unsafe && !r.witnesses.dismissed &&
    r.witnesses.presentIds.length === 36 && BIZARRO_WITNESS_IDS.every(id => r.witnesses.presentIds.includes(id));
}
export function dismissBizarroWitnesses(s: SliceState, reason: string): void {
  const r = s.bizarroSorcerer.ritual;
  r.witnesses.exitedIds = [...new Set([...r.witnesses.exitedIds, ...r.witnesses.presentIds])];
  r.witnesses.presentIds = []; r.witnesses.dismissed = true; r.witnesses.sightlineVerified = false;
  r.invalidReason ??= reason; const a = currentBizarroAttempt(s); if (a) a.invalidReason ??= reason;
}
function availableBody(t: BizarroTarget): boolean { return (t.status === 'UNSURVEYED' || t.status === 'AVAILABLE') && t.terminalBody === null; }
function sourceOpen(s: SliceState): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      s.progression.pathwayId !== 'diviner' || ![5, 4].includes(s.progression.sequence ?? 0)) return '需要清醒存活、实际在贝克兰德的秘偶大师或诡法师。';
  if (hasMarionettistOpenPractice(s) || hasMarionettistOpenCapture(s) || Object.values(s.faceless.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.faceless.outfit.location === 'PLAYER' || s.bizarroSorcerer.life.practice.activeCase !== null || s.bizarroSorcerer.life.practice.ownerAt !== 'NEAR' || ['HELD', 'INITIAL_CONTROL'].includes(s.bizarroSorcerer.life.mouse.status) || s.bizarroSorcerer.life.worms.assigned > 0 || Object.values(s.bizarroSorcerer.life.cases).some(c => c.status === 'PREPARED')) return '先实际收束原接触、捕获、海岸仪式或生活练习，并归还原道具服。';
  if (s.combat) return '先结算当前真实战斗；只能通过战斗撤退离场。';
  return null;
}
export function bizarroRitualCommandReason(s: SliceState, c: BizarroRitualCommand): string | null {
  if (!validateBizarroRitualCommand(c)) return '仪式命令无效；真实开战需要独立明确确认。';
  const r = s.bizarroSorcerer.ritual;
  const common = sourceOpen(s); if (common) return common;
  if (c.type === 'CLOSE_RITUAL') return ['SURVEYED', 'PREPARED', 'ASSEMBLED', 'FINALE'].includes(r.phase) ? null : '当前没有可收场的筹备或谢幕。';
  if (r.phase === 'FINALE') return '必须在本场0行动饮用原瓶或0行动放弃谢幕，不能离场后补喝。';
  if (c.type !== 'RECEIVE_LEAD' && s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REQUEST_NEXT_RITUAL') {
    const t = r.targets.find(t => t.id === c.targetId);
    return !['CLOSED', 'UNSEEN'].includes(r.phase) ? '先结束上一场，不能覆盖原筹备。' : !t || !availableBody(t) ? '只有未挑战的原个体可另筹一场。' : null;
  }
  if (c.type === 'REQUEST_NEW_LEAD') return !['CLOSED', 'UNSEEN'].includes(r.phase) ? '先结束当前场次。'
    : r.targets.some(availableBody) ? '现有未挑战来源尚在；先调查原登记个体。' : r.pendingLead || r.leadRequestedWeek !== null ? '已有一条待收或待查线索。' : null;
  if (c.type === 'RECEIVE_LEAD') return r.leadRequestedWeek === null || s.week <= r.leadRequestedWeek ? '须在请求后的下一真实周取得一条未核实地点线索。' : r.pendingLead ? '先实际勘察已有线索。' : null;
  if (c.type === 'SURVEY_RITUAL') {
    const target = r.targets.find(t => t.id === c.targetId), lead = r.pendingLead?.targetId === c.targetId;
    return !['UNSEEN', 'CLOSED', 'SURVEYED'].includes(r.phase) ? '先收束原舞台筹备。' : s.week < r.earliestSurveyWeek ? '新场调查须等到上一场之后的下一真实周。'
      : !lead && (!target || !availableBody(target)) ? '该原目标不可再挑战；死者与旧伤不会刷新。'
      : s.spirituality < 2 ? '本人调查需要2灵性。' : null;
  }
  if (c.type === 'PREPARE_STAGE') return s.progression.sequence !== 5 ? '晋升后的可选实战无需重演晋升仪式。'
    : r.phase !== 'SURVEYED' ? '先本人勘察真实原个体。' : s.cash < 60 ? '清理原通道与预约成年观众需要60便士。' : null;
  if (c.type === 'GATHER_WITNESSES') return r.phase !== 'PREPARED' || r.preparedWeek === null || s.week <= r.preparedWeek ? '预约后的下一真实周，36名成年观众才能实际到场。' : null;
  if (c.type === 'START_RITUAL') {
    const target = r.targets.find(t => t.id === r.currentTargetId);
    if (!target || target.status !== 'AVAILABLE' || target.terminalBody !== null) return '原目标已经挑战或原身体来源失效。';
    const bottle = s.bizarroSorcerer.bottles.find(b => b.id === c.bottleId);
    return s.progression.sequence !== 5 ? '只有序列5本人可开始本次晋升仪式。'
      : r.phase !== 'ASSEMBLED' || r.visitWeek !== s.week || !audiencePresent(r) ? '必须本场36名成年人实际到场、净空视线与原退路仍成立。'
      : !bottle || bottle.status !== 'PREPARED' || bottle.ritualAttemptId !== null ? '须携带独立调配且未使用的原瓶。'
      : !s.magician.lantern.prepared || s.magician.lantern.oilSpent < 1 ? '须先以已有灯油点燃本人原灯，才能真实火中登台。'
      : s.spirituality < 5 ? '幻影登台2灵性与真实火跳3灵性合计需要5灵性。' : null;
  }
  if (c.type === 'START_CHALLENGE') return s.progression.sequence !== 4 ? '可选非仪式实战只对晋升后的序列4开放。'
    : r.phase !== 'SURVEYED' || r.currentTargetId !== c.targetId || !r.targets.some(t => t.id === c.targetId && t.status === 'AVAILABLE' && t.terminalBody === null) ? '先另付调查行动与2灵性，现场核实这个未挑战的原个体。' : null;
  return '不支持的仪式动作。';
}
function resetScene(r: BizarroRitualState): void {
  r.preparedWeek = null; r.visitWeek = null; r.attemptId = null; r.bottleId = null; r.startHistoryIndex = null;
  r.witnesses = emptyWitnesses(); r.opening = { illusionUsed: false, flameJumpUsed: false }; r.enemySpirituality = 0;
  r.veil = false; r.invalidReason = null; r.killEvidence = null; r.consumedBottleId = null;
}
export function handleBizarroRitualCommand(s: SliceState, c: BizarroRitualCommand, _ctx?: SeerContext): { error?: string; message?: string } {
  const reason = bizarroRitualCommandReason(s, c); if (reason) return { error: reason };
  const r = s.bizarroSorcerer.ritual;
  if (c.type === 'CLOSE_RITUAL') {
    const a = currentBizarroAttempt(s); if (a && a.closedWeek === null) { a.closedWeek = s.week; a.outcome = 'ABANDONED'; }
    dismissBizarroWitnesses(s, '本人沿原通道收场；本次死亡不能在离场后补喝'); r.phase = 'CLOSED'; s.magician.lantern.prepared = false;
    if (a) r.earliestSurveyWeek = s.week + 1;
    return { message: '0行动沿真实原出口收场。观众实际散去，原瓶、伤势、死亡和已付成本保留；仍可保持当前序列。' };
  }
  if (c.type !== 'RECEIVE_LEAD') s.actionsRemaining -= 1;
  if (c.type === 'REQUEST_NEXT_RITUAL') { resetScene(r); r.currentTargetId = c.targetId; r.phase = 'UNSEEN'; r.earliestSurveyWeek = Math.max(r.earliestSurveyWeek, s.week + 1); return { message: '登记下一原个体；下个真实周另行现场核实，不复活或刷新任何旧身体。' }; }
  if (c.type === 'REQUEST_NEW_LEAD') { r.leadRequestedWeek = s.week; return { message: '花费1行动向原场方巡查提出地点查询。下一真实周可取一条尚未核实的新线索，不立即生成敌人。' }; }
  if (c.type === 'RECEIVE_LEAD') {
    r.leadOrdinal += 1; const stem = `${s.runId}:B4-LEAD-${r.leadOrdinal}`;
    r.pendingLead = { id: stem, targetId: `${stem}:BODY`, siteId: `${stem}:COURT`, originalBellId: `${stem}:BELL`,
      source: `原场方第${r.leadOrdinal}次巡查：另一个废试音院原钟下有活物目击，位格和存活均待本人勘察（G）`, receivedWeek: s.week };
    r.leadRequestedWeek = null; return { message: '0行动领取一条未核实地点线索。尚无已证实半神敌人；需另付1行动、2灵性亲自勘察。' };
  }
  if (c.type === 'SURVEY_RITUAL') {
    s.spirituality -= 2;
    if (r.pendingLead?.targetId === c.targetId) {
      const lead = r.pendingLead; r.targets.push({ id: lead.targetId, name: `巡查原钟帷幕兽${r.leadOrdinal}`, siteId: lead.siteId,
        originalBellId: lead.originalBellId, source: lead.source, status: 'UNSURVEYED', surveyedWeek: null, terminalBody: null }); r.pendingLead = null;
    }
    resetScene(r); const t = r.targets.find(t => t.id === c.targetId)!; t.status = 'AVAILABLE'; t.surveyedWeek = s.week;
    r.currentTargetId = t.id; r.phase = 'SURVEYED'; r.mode = s.progression.sequence === 4 ? 'CHALLENGE' : 'RITUAL';
    return { message: '本人实际走到该原钟院，核实同一活体为原创序列4等价生物：钟周8米固有活动/施法界，2米原灯落点，30米日光石阶与真实原退出通道。幻壳没有灵体线，实体有；没有预读战盘。' };
  }
  if (c.type === 'PREPARE_STAGE') { s.cash -= 60; r.preparedWeek = s.week; r.phase = 'PREPARED'; r.witnesses.invitedIds = [...BIZARRO_WITNESS_IDS]; return { message: '本人付60便士清理原石阶与退路，安排幻影→真火登台→亲自真实击杀→饮药谢幕的剧目。邀请36名知情成年人，下一真实周才能到场；筹备不伤敌、不提供保护罩。' }; }
  if (c.type === 'GATHER_WITNESSES') {
    r.visitWeek = s.week; r.phase = 'ASSEMBLED'; r.witnesses.presentIds = [...r.witnesses.invitedIds]; r.witnesses.arrivedWeek = s.week; r.witnesses.sightlineVerified = true;
    return { message: '三个组共36名成年人亲自沿原石阶到达距钟30米的日光看台，已知危险并愿意观看。净空视线与真实退路已经复核；30米不是全能防护。可0行动点原灯或收场。' };
  }
  const ritual = c.type === 'START_RITUAL';
  const target = r.targets.find(t => t.id === r.currentTargetId)!;
  if (!target || target.status !== 'AVAILABLE' || target.terminalBody !== null) throw new Error('原活体来源失效');
  r.mode = ritual ? 'RITUAL' : 'CHALLENGE'; r.visitWeek = s.week;
  if (ritual) { s.spirituality -= 5; r.opening = { illusionUsed: true, flameJumpUsed: true }; }
  r.bottleId = ritual ? c.bottleId : null; r.startHistoryIndex = s.combatHistory.length;
  r.attemptId = `${s.runId}:B4-ATTEMPT-${r.attempts.length + 1}`; r.enemySpirituality = 40; r.veil = false; r.phase = 'FIGHTING'; target.status = 'ENGAGED';
  r.attempts.push({ id: r.attemptId, targetId: target.id, mode: r.mode, bottleId: r.bottleId, week: s.week,
    startHistoryIndex: r.startHistoryIndex, terminalHistoryIndex: null, closedWeek: null, playerAttackCount: 0,
    arrivedWitnessIds: [...r.witnesses.presentIds], deathWitnessIds: [], opening: { ...r.opening }, invalidReason: null,
    killEvidence: null, consumedBottleId: null, outcome: 'FIGHTING' });
  s.combat = { encounterId: 'BIZARRO_RITUAL', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  return { message: ritual ? '本人耗5灵性完成有限幻影与真身火中登台，没有造成敌伤。进入真实第1回合：原兽1250位格、40有限灵性；纸人、纸、油和伤势均继承原库存。战斗与服药均可能失败或死亡。'
    : '支付1行动走入原钟2米近区，开始可选序列4实战。非晋升仪式，无药瓶、观众或自动尾声；原兽与独立有限灵性、伤势真实结算，原出口始终明确。' };
}
export function settleBizarroRitual(s: SliceState, outcome: string, ctx?: SeerContext): void {
  const r = s.bizarroSorcerer.ritual, c = s.combat, a = currentBizarroAttempt(s);
  if (!c || c.encounterId !== 'BIZARRO_RITUAL' || r.phase !== 'FIGHTING' || !a) throw new Error('没有本场真实帷幕兽战斗来源');
  if (outcome === 'CONTINUE') return;
  if (!['ENEMY_DEAD', 'RETREATED', 'PLAYER_DEAD'].includes(outcome) || !c.lastRound ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER')) ||
      (outcome === 'RETREATED' && c.lastRound.retreat !== 'SUCCESS') || (outcome === 'PLAYER_DEAD' && s.health !== 0)) throw new Error('本场结局与共享真实身体/末轮不一致');
  const t = r.targets.find(t => t.id === a.targetId)!;
  t.status = c.enemyStatus === 'DEAD' ? 'DEAD' : 'LEFT_ALIVE';
  t.terminalBody = { health: c.enemyHealth, mind: c.enemyMind, spirituality: r.enemySpirituality,
    injuries: c.enemyInjuries.map(i => ({ ...i })), risk: c.enemyRisk, status: c.enemyStatus === 'DEAD' ? 'DEAD' : 'RESISTING' };
  a.terminalHistoryIndex = s.combatHistory.length - 1;
  if (outcome === 'ENEMY_DEAD') {
    a.killEvidence = { targetId: t.id, equivalentSequence: 4, attemptId: a.id, terminalHistoryIndex: a.terminalHistoryIndex, killer: 'PLAYER' };
    r.killEvidence = { ...a.killEvidence };
    if (audiencePresent(r)) a.deathWitnessIds = [...r.witnesses.presentIds];
  }
  s.combat = null; s.magician.lantern.prepared = false; r.veil = false;
  const bottle = s.bizarroSorcerer.bottles.find(b => b.id === r.bottleId);
  if (outcome === 'ENEMY_DEAD' && r.mode === 'RITUAL' && s.health > 0 && s.status === 'ACTIVE' && a.playerAttackCount > 0 &&
      a.opening.illusionUsed && a.opening.flameJumpUsed && a.deathWitnessIds.length === 36 && !a.invalidReason && bottle?.status === 'PREPARED') {
    r.phase = 'FINALE'; a.outcome = 'FINALE';
    ctx?.note('真实死亡后的同场谢幕', '同一原兽已在共享战斗中真正死亡，36名实际到场成年人亲见。只可0行动确认饮用原瓶或0行动放弃收场；旧死亡不能重用。'); return;
  }
  a.outcome = outcome === 'ENEMY_DEAD' ? 'ENEMY_DEAD' : outcome === 'RETREATED' ? 'RETREATED' : 'PLAYER_DEAD'; a.closedWeek = s.week; r.earliestSurveyWeek = s.week + 1;
  dismissBizarroWitnesses(s, a.invalidReason ?? (r.mode === 'CHALLENGE' ? '非仪式实战结束' : '本场未形成有效饮药谢幕'));
  r.phase = outcome === 'PLAYER_DEAD' ? 'LOST' : 'CLOSED';
  ctx?.note('原钟院真实结局已保留', outcome === 'ENEMY_DEAD' ? '原兽永久死亡；本场没有可用的仪式饮药尾声。尸体不是魔药材料、秘偶或可重刷活体。' : outcome === 'RETREATED' ? '本人沿原通道实际退出8米界，原兽不能越过其固有限制追来。双方真实伤势、消耗与原身体保留，本个体不再公开挑战。' : '本人真实死亡。原兽剩余身体与原物保留，无保底复活或自动晋升。');
}
export function canConsumeBizarroFinale(s: SliceState, bottleId: string): boolean {
  const r = s.bizarroSorcerer?.ritual; if (!r) return false;
  const a = currentBizarroAttempt(s), b = s.bizarroSorcerer.bottles.find(b => b.id === bottleId), t = r.targets.find(t => t.id === r.currentTargetId);
  const e = a?.killEvidence, h = e ? s.combatHistory[e.terminalHistoryIndex] : null;
  return r.phase === 'FINALE' && r.mode === 'RITUAL' && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 &&
    s.progression.pathwayId === 'diviner' && s.progression.sequence === 5 && !s.combat && s.activeEvent === null &&
    r.visitWeek === s.week && r.bottleId === bottleId && b?.status === 'PREPARED' && b.ritualAttemptId === null &&
    !!a && a.outcome === 'FINALE' && a.closedWeek === null && a.bottleId === bottleId && a.playerAttackCount > 0 &&
    a.opening.illusionUsed && a.opening.flameJumpUsed && !a.invalidReason && audiencePresent(r) &&
    a.deathWitnessIds.length === 36 && BIZARRO_WITNESS_IDS.every(id => a.deathWitnessIds.includes(id) && a.arrivedWitnessIds.includes(id)) &&
    !!t && !!e && e.attemptId === a.id && e.targetId === t?.id && e.killer === 'PLAYER' && e.equivalentSequence === 4 &&
    t.status === 'DEAD' && t.terminalBody?.health === 0 && t.terminalBody.status === 'DEAD' &&
    h?.winner === 'PLAYER' && h.retreat === 'NONE' && h.bizarroOutcome?.targetId === t.id && h.bizarroOutcome.attemptId === a.id &&
    h.bizarroOutcome.enemyStatus === 'DEAD' && h.bizarroOutcome.enemyHealth === 0 && h.bizarroOutcome.deathWitnessIds.length === 36 &&
    h.bizarroOutcome.deathWitnessIds.every(id => a.deathWitnessIds.includes(id)) && !h.bizarroOutcome.viewObstructed && !h.bizarroOutcome.unsafe && e.terminalHistoryIndex === s.combatHistory.length - 1;
}
/** Called only after the acquisition handler has validated and consumed the
 * bound bottle. It deliberately accepts the resulting S4 or failed S5 state. */
export function consumeBizarroFinale(s: SliceState, bottleId: string): void {
  const r = s.bizarroSorcerer.ritual, a = currentBizarroAttempt(s), b = s.bizarroSorcerer.bottles.find(b => b.id === bottleId);
  if (r.phase !== 'FINALE' || !a || a.outcome !== 'FINALE' || a.bottleId !== bottleId || b?.status !== 'CONSUMED' || b.ritualAttemptId !== a.id) throw new Error('只能关闭已实际消耗原瓶的同一谢幕');
  a.consumedBottleId = bottleId; a.closedWeek = s.week; a.outcome = 'CONSUMED'; r.consumedBottleId = bottleId;
  // Leaving after the completed finale must not retroactively invalidate the
  // actual death witnesses or the already-consumed original dose.
  r.witnesses.exitedIds = [...new Set([...r.witnesses.exitedIds, ...r.witnesses.presentIds])];
  r.witnesses.presentIds = []; r.witnesses.dismissed = true; r.witnesses.sightlineVerified = false;
  r.phase = 'CLOSED'; r.earliestSurveyWeek = s.week + 1;
}

export interface BizarroRitualProjection {
  phase: BizarroRitualPhase; mode: 'RITUAL' | 'CHALLENGE'; currentTargetId: string | null; targetName: string;
  story: string; status: string; source: string; equipment: string; witnessesPresent: number; witnessesExited: number;
  viewObstructed: boolean; unsafe: boolean; enemySpirituality: number; veil: boolean; openingComplete: boolean;
  killEvidence: string | null; finaleBottleId: string | null; attempts: number; consumedBottleId: string | null;
  pendingLead: string | null; targets: { id: string; name: string; site: string; status: string }[]; actions: BizarroSorcererAction[];
}
export function projectBizarroRitual(s: SliceState): BizarroRitualProjection {
  const r = s.bizarroSorcerer.ritual, t = r.targets.find(t => t.id === r.currentTargetId);
  const actions: BizarroSorcererAction[] = [];
  if (s.progression.pathwayId !== 'diviner' || ![5, 4].includes(s.progression.sequence ?? 0)) return {
    phase: 'UNSEEN', mode: 'RITUAL', currentTargetId: null, targetName: '尚未开放', story: '', status: '尚未开放', source: '', equipment: '',
    witnessesPresent: 0, witnessesExited: 0, viewObstructed: false, unsafe: false, enemySpirituality: 0, veil: false, openingComplete: false,
    killEvidence: null, finaleBottleId: null, attempts: 0, consumedBottleId: null, pendingLead: null, targets: [], actions: [],
  };
  const phaseLabels: Record<BizarroRitualPhase, string> = { UNSEEN: '尚未调查', SURVEYED: '原活体已现场核实', PREPARED: '已预约，等待下一真实周', ASSEMBLED: '36名成年观众实际到场', FIGHTING: '真实交战中', FINALE: '同场饮药谢幕', CLOSED: '已收场', LOST: '本人真实死亡' };
  const targetLabels: Record<BizarroTarget['status'], string> = { UNSURVEYED: '来源待勘察', AVAILABLE: '原活体已核实', ENGAGED: '同一身体交战中', DEAD: '原身体永久死亡', LEFT_ALIVE: '原活体与真实伤势留档，已挑战' };
  const add = (c: BizarroRitualCommand, label: string, cost: string) => { const reason = bizarroRitualCommandReason(s, c); actions.push({ id: `ritual:${c.type}:${'targetId' in c ? c.targetId : 'bottleId' in c ? c.bottleId : ''}`, label, cost, enabled: !reason, reason, command: c }); };
  if (['UNSEEN', 'CLOSED', 'SURVEYED'].includes(r.phase)) {
    for (const target of r.targets.filter(availableBody)) add({ type: 'SURVEY_RITUAL', targetId: target.id }, `本人勘察${target.name}`, '1行动 / 2灵性');
    if (r.pendingLead) add({ type: 'SURVEY_RITUAL', targetId: r.pendingLead.targetId }, '现场核实新地点线索', '1行动 / 2灵性');
    if (!r.targets.some(availableBody) && !r.pendingLead) add(r.leadRequestedWeek === null ? { type: 'REQUEST_NEW_LEAD' } : { type: 'RECEIVE_LEAD' }, r.leadRequestedWeek === null ? '查询另一原地点线索' : '领取未核实新线索', r.leadRequestedWeek === null ? '1行动 / 下一真实周领取' : '0行动 / 待现场核实');
  }
  if (r.phase === 'SURVEYED') {
    if (s.progression.sequence === 4 && t) add({ type: 'START_CHALLENGE', targetId: t.id, confirmed: true }, '确认可选序列4真实实战', '1行动 / 非晋升仪式');
    else add({ type: 'PREPARE_STAGE' }, '筹备赤灯三幕并邀请成年人', '1行动 / 60便士');
  }
  if (r.phase === 'PREPARED') add({ type: 'GATHER_WITNESSES' }, '下一真实周集合36名观众', '1行动');
  if (r.phase === 'ASSEMBLED') for (const b of s.bizarroSorcerer.bottles.filter(b => b.status === 'PREPARED')) add({ type: 'START_RITUAL', bottleId: b.id, confirmed: true }, `确认携原瓶开演：${b.id}`, '1行动 / 5灵性 / 真实死亡风险');
  if (['SURVEYED', 'PREPARED', 'ASSEMBLED', 'FINALE'].includes(r.phase)) add({ type: 'CLOSE_RITUAL' }, r.phase === 'FINALE' ? '放弃本次饮药，收场' : '收场并保留当前序列', '0行动');
  return { phase: r.phase, mode: r.mode, currentTargetId: r.currentTargetId, targetName: t?.name ?? '尚未勘察',
    story: '赤灯谢幕（原创G）：本人谋划幻影与真火登场，在36名实际到场成年人前亲自真实杀死序列4等价帷幕兽，再于本场谢幕饮药。没有和平替代、NPC代打或胜利保证。',
    status: `${phaseLabels[r.phase]}${r.invalidReason ? `；${r.invalidReason}` : ''}`, source: t?.source ?? '原登记册有甲、乙、丙三个不同原钟院、原钟与活体，分别调查，不复制身体。',
    equipment: `本人灵性${s.spirituality}；原灯${s.magician.lantern.prepared ? '已点燃' : '未点燃'}；原油${s.magician.lantern.oilHeld}份，原纸${s.clown.paperSheets}张，预制原纸人${s.magician.figurinesHeld}个。开演5灵性；每次原纸人替身另耗1纸人/5灵性。物资不足可能死亡，无补发。`,
    witnessesPresent: r.witnesses.presentIds.length, witnessesExited: r.witnesses.exitedIds.length,
    viewObstructed: r.witnesses.viewObstructed, unsafe: r.witnesses.unsafe, enemySpirituality: r.enemySpirituality,
    veil: r.veil, openingComplete: r.opening.illusionUsed && r.opening.flameJumpUsed,
    killEvidence: r.killEvidence ? `${r.killEvidence.targetId}：原身体真实死亡；末轮记录${r.killEvidence.terminalHistoryIndex + 1}，本人攻击` : null,
    finaleBottleId: r.phase === 'FINALE' ? r.bottleId : null, attempts: r.attempts.length, consumedBottleId: r.consumedBottleId,
    pendingLead: r.pendingLead ? `${r.pendingLead.source}；未现场验证` : r.leadRequestedWeek !== null ? '地点请求已提出，等待下一真实周' : null,
    targets: r.targets.map(t => ({ id: t.id, name: `${t.name}（原创G，序列4等价）`, site: t.siteId, status: targetLabels[t.status] })), actions };
}

const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const unique = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string') && new Set(v).size === v.length;
const week = (v: unknown): boolean => v === null || integer(v, 1);
const shape = (v: unknown, keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const stringOrNull = (v: unknown): boolean => v === null || typeof v === 'string';
const sameEvidence = (a: BizarroKillEvidence | null, b: BizarroKillEvidence | null): boolean => {
  if (a === null || b === null) return a === null && b === null;
  const fields = ['targetId', 'equivalentSequence', 'attemptId', 'terminalHistoryIndex', 'killer'] as const;
  return shape(a, fields) && shape(b, fields) && fields.every(key => a[key] === b[key]);
};
export function validateBizarroRitualState(s: SliceState): boolean {
  const r = s.bizarroSorcerer?.ritual; if (!r || typeof r !== 'object' || !Array.isArray(s.bizarroSorcerer.bottles) || !Array.isArray(s.combatHistory)) return false;
  if (!shape(r, ['phase','mode','currentTargetId','preparedWeek','visitWeek','earliestSurveyWeek','attemptId','bottleId','startHistoryIndex','witnesses','opening','enemySpirituality','veil','invalidReason','killEvidence','consumedBottleId','targets','attempts','leadOrdinal','leadRequestedWeek','pendingLead']) ||
      !(r.pendingLead === null || (!!r.pendingLead && typeof r.pendingLead === 'object')) ||
      ![r.currentTargetId,r.attemptId,r.bottleId,r.consumedBottleId].every(stringOrNull) ||
      !(r.startHistoryIndex === null || integer(r.startHistoryIndex)) ||
      ![r.preparedWeek,r.visitWeek,r.leadRequestedWeek].every(v => week(v) && (v === null || v <= s.week)) ||
      !shape(r.opening, ['illusionUsed','flameJumpUsed']) ||
      !shape(r.witnesses, ['invitedIds','presentIds','exitedIds','arrivedWeek','sightlineVerified','viewObstructed','unsafe','dismissed'])) return false;
  if (!['UNSEEN', 'SURVEYED', 'PREPARED', 'ASSEMBLED', 'FIGHTING', 'FINALE', 'CLOSED', 'LOST'].includes(r.phase) || !['RITUAL', 'CHALLENGE'].includes(r.mode) ||
      !Array.isArray(r.targets) || r.targets.length < 3 || !Array.isArray(r.attempts) || !integer(r.leadOrdinal) || !week(r.leadRequestedWeek) ||
      !week(r.preparedWeek) || !week(r.visitWeek) || !integer(r.earliestSurveyWeek) || !integer(r.enemySpirituality) || r.enemySpirituality > 40 || typeof r.veil !== 'boolean' ||
      !r.opening || typeof r.opening.illusionUsed !== 'boolean' || typeof r.opening.flameJumpUsed !== 'boolean' ||
      !(r.invalidReason === null || typeof r.invalidReason === 'string')) return false;
  const w = r.witnesses;
  if (!w || !unique(w.invitedIds) || !unique(w.presentIds) || !unique(w.exitedIds) || !week(w.arrivedWeek) || (w.arrivedWeek !== null && w.arrivedWeek > s.week) ||
      !['sightlineVerified', 'viewObstructed', 'unsafe', 'dismissed'].every(k => typeof w[k as keyof typeof w] === 'boolean') ||
      [...w.invitedIds, ...w.presentIds, ...w.exitedIds].some(id => !BIZARRO_WITNESS_IDS.includes(id)) ||
      w.presentIds.some(id => !w.invitedIds.includes(id) || w.exitedIds.includes(id)) ||
      ((w.viewObstructed || w.unsafe || w.dismissed) && (w.presentIds.length > 0 || w.sightlineVerified))) return false;
  if (r.targets.some(t => !shape(t, ['id','name','siteId','originalBellId','source','status','surveyedWeek','terminalBody'])) ||
      r.attempts.some(a => !shape(a, ['id','targetId','mode','bottleId','week','startHistoryIndex','terminalHistoryIndex','closedWeek','playerAttackCount','arrivedWitnessIds','deathWitnessIds','opening','invalidReason','killEvidence','consumedBottleId','outcome']))) return false;
  if (new Set(r.targets.map(t => t.id)).size !== r.targets.length || new Set(r.targets.map(t => t.siteId)).size !== r.targets.length ||
      new Set(r.targets.map(t => t.originalBellId)).size !== r.targets.length || new Set(r.attempts.map(a => a.id)).size !== r.attempts.length ||
      new Set(r.attempts.map(a => a.targetId)).size !== r.attempts.length) return false;
  if (r.targets.slice(0, 3).some((t, i) => t.id !== `B4-COPPER-BELL-${['A', 'B', 'C'][i]}` || t.siteId !== `B4-OLD-SOUND-COURT-${['A', 'B', 'C'][i]}` || t.originalBellId !== `B4-ORIGINAL-BELL-${['A', 'B', 'C'][i]}`)) return false;
  for (const t of r.targets) {
    if (!t || typeof t.id !== 'string' || typeof t.siteId !== 'string' || typeof t.originalBellId !== 'string' || typeof t.name !== 'string' || typeof t.source !== 'string' ||
        !['UNSURVEYED', 'AVAILABLE', 'ENGAGED', 'DEAD', 'LEFT_ALIVE'].includes(t.status) || (!week(t.surveyedWeek) || (t.surveyedWeek !== null && t.surveyedWeek > s.week)) ||
        (t.status !== 'UNSURVEYED' && t.surveyedWeek === null)) return false;
    const b = t.terminalBody, a = r.attempts.find(a => a.targetId === t.id);
    if (['DEAD', 'LEFT_ALIVE'].includes(t.status)) {
      if (!b || !shape(b, ['health','mind','spirituality','injuries','risk','status']) || !a || !integer(b.health) || b.health > 100 || !integer(b.mind) || b.mind > 100 || !integer(b.spirituality) || b.spirituality > 40 || !integer(b.risk) ||
          !Array.isArray(b.injuries) || b.injuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity)) ||
          (t.status === 'DEAD' ? b.health !== 0 || b.status !== 'DEAD' : b.health <= 0 || b.status !== 'RESISTING')) return false;
    } else if (b !== null || (t.status === 'ENGAGED' ? !a || a.id !== r.attemptId || r.phase !== 'FIGHTING' : !!a)) return false;
  }
  if (r.targets.length > 3 + r.leadOrdinal) return false;
  if (r.pendingLead && (!shape(r.pendingLead, ['id','targetId','source','siteId','originalBellId','receivedWeek']) || typeof r.pendingLead.id !== 'string' || typeof r.pendingLead.targetId !== 'string' || typeof r.pendingLead.source !== 'string' ||
      typeof r.pendingLead.siteId !== 'string' || typeof r.pendingLead.originalBellId !== 'string' || (!integer(r.pendingLead.receivedWeek, 1) || r.pendingLead.receivedWeek > s.week) ||
      r.targets.some(t => t.id === r.pendingLead!.targetId || t.siteId === r.pendingLead!.siteId || t.originalBellId === r.pendingLead!.originalBellId) || r.leadRequestedWeek !== null)) return false;
  for (const a of r.attempts) {
    if (!shape(a.opening, ['illusionUsed','flameJumpUsed']) || !stringOrNull(a.bottleId) || !stringOrNull(a.consumedBottleId) || !stringOrNull(a.invalidReason) || a.week > s.week || (a.closedWeek !== null && (a.closedWeek < a.week || a.closedWeek > s.week))) return false;
    if (!a || typeof a.id !== 'string' || !r.targets.some(t => t.id === a.targetId) || !['RITUAL', 'CHALLENGE'].includes(a.mode) || !integer(a.week, 1) ||
        !integer(a.startHistoryIndex) || a.startHistoryIndex > s.combatHistory.length || !integer(a.playerAttackCount) || !week(a.closedWeek) ||
        !unique(a.arrivedWitnessIds) || !unique(a.deathWitnessIds) || a.deathWitnessIds.some(id => !a.arrivedWitnessIds.includes(id)) ||
        a.arrivedWitnessIds.some(id => !BIZARRO_WITNESS_IDS.includes(id)) || !a.opening || typeof a.opening.illusionUsed !== 'boolean' || typeof a.opening.flameJumpUsed !== 'boolean' ||
        !['FIGHTING', 'FINALE', 'ENEMY_DEAD', 'RETREATED', 'PLAYER_DEAD', 'CONSUMED', 'ABANDONED'].includes(a.outcome)) return false;
    if (a.mode === 'RITUAL' ? !s.bizarroSorcerer.bottles.some(b => b.id === a.bottleId) || !a.opening.illusionUsed || !a.opening.flameJumpUsed || a.arrivedWitnessIds.length !== 36
      : a.bottleId !== null || a.arrivedWitnessIds.length !== 0 || a.deathWitnessIds.length !== 0 || a.consumedBottleId !== null) return false;
    if (a.outcome === 'FIGHTING') { if (a.id !== r.attemptId || a.terminalHistoryIndex !== null || a.closedWeek !== null || a.killEvidence !== null) return false; }
    else {
      if (!integer(a.terminalHistoryIndex) || a.terminalHistoryIndex < a.startHistoryIndex || a.terminalHistoryIndex >= s.combatHistory.length) return false;
      const rows = s.combatHistory.slice(a.startHistoryIndex, a.terminalHistoryIndex + 1), last = rows.at(-1)!;
      if (!rows.every((h, i) => h.bizarroOutcome?.targetId === a.targetId && h.bizarroOutcome.attemptId === a.id && h.round === i + 1 && h.winner !== null && (i === rows.length - 1 || h.retreat !== 'SUCCESS'))) return false;
      const target = r.targets.find(t => t.id === a.targetId)!;
      const facts = last.bizarroOutcome;
      if (!facts || facts.enemyHealth !== target.terminalBody?.health || facts.enemyMind !== target.terminalBody?.mind || facts.enemySpirituality !== target.terminalBody?.spirituality || facts.enemyStatus !== target.terminalBody?.status || facts.playerAttackCount !== a.playerAttackCount) return false;
      if (a.outcome === 'RETREATED' && last.retreat !== 'SUCCESS') return false;
      if (a.outcome === 'FINALE' ? a.closedWeek !== null || r.phase !== 'FINALE' : a.closedWeek === null) return false;
      if (a.killEvidence) { const e = a.killEvidence, t = r.targets.find(t => t.id === a.targetId)!;
        if (!shape(e, ['targetId','equivalentSequence','attemptId','terminalHistoryIndex','killer']) || e.targetId !== t.id || e.attemptId !== a.id || e.equivalentSequence !== 4 || e.killer !== 'PLAYER' || e.terminalHistoryIndex !== a.terminalHistoryIndex ||
            t.status !== 'DEAD' || t.terminalBody?.health !== 0 || facts.enemyStatus !== 'DEAD' || facts.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE' || a.playerAttackCount < 1) return false;
      } else if (a.deathWitnessIds.length || ['FINALE', 'ENEMY_DEAD', 'CONSUMED'].includes(a.outcome)) return false;
      if (a.deathWitnessIds.length !== facts.deathWitnessIds.length || a.deathWitnessIds.some(id => !facts.deathWitnessIds.includes(id)) || (a.deathWitnessIds.length > 0 && (facts.viewObstructed || facts.unsafe))) return false;
      if (a.consumedBottleId !== null) { const b = s.bizarroSorcerer.bottles.find(b => b.id === a.consumedBottleId);
        if (a.outcome !== 'CONSUMED' || a.consumedBottleId !== a.bottleId || b?.status !== 'CONSUMED' || b.ritualAttemptId !== a.id) return false; }
    }
  }
  if (r.currentTargetId !== null && !r.targets.some(t => t.id === r.currentTargetId)) return false;
  const current = currentBizarroAttempt(s);
  if (r.attemptId !== null && (!current || current.targetId !== r.currentTargetId || current.bottleId !== r.bottleId || current.startHistoryIndex !== r.startHistoryIndex)) return false;
  if (current && (!sameEvidence(r.killEvidence, current.killEvidence) || r.consumedBottleId !== current.consumedBottleId || r.mode !== current.mode)) return false;
  if (!current && (r.killEvidence !== null || r.consumedBottleId !== null || r.startHistoryIndex !== null || r.bottleId !== null)) return false;
  if (r.phase === 'FIGHTING') return hasBizarroRitualOpponent(s);
  if (s.combat?.encounterId === 'BIZARRO_RITUAL') return false;
  if (r.phase === 'FINALE') return r.bottleId !== null && canConsumeBizarroFinale(s, r.bottleId);
  if (r.phase === 'ASSEMBLED') return r.visitWeek === s.week && audiencePresent(r) && r.preparedWeek !== null && r.preparedWeek < s.week;
  return true;
}
