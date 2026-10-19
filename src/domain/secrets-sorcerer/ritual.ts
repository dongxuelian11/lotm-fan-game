import type { SliceInjury, SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { hasTravelerOpenPractice } from '../traveler/encounter.js';
import type { SecretsSorcererAction } from './types.js';

/** Original G creatures, sites, frame and quantities. No canonical species or recipe is claimed. */
export type SecretsSorcererRitualPhase = 'UNSEEN' | 'SURVEYED' | 'PREPARED' | 'FIGHTING' | 'SEALED' | 'FINISHED' | 'CLOSED' | 'LOST';
export interface SecretsSorcererTarget {
  id: string; entityId: string; name: string; siteId: string; source: string;
  status: 'UNSURVEYED' | 'AVAILABLE' | 'ENGAGED' | 'LEFT_ALIVE' | 'DEAD' | 'SEALED';
  surveyedWeek: number | null; hostileVerified: boolean; equivalentSequence: 4;
  body: { health: number; mind: number; spirituality: number; injuries: SliceInjury[]; risk: number };
}
export interface SecretsSorcererSealCase {
  id: string; grade: 1; capacity: 1; charges: number; custody: 'PLAYER' | 'ARCHIVE';
  location: 'FLOOR' | 'PLAYER' | 'ARCHIVE'; targetId: string | null; sealsIntact: boolean;
  preparedWeek: number; returnedWeek: number | null; attemptId: string | null;
}
export interface SecretsSorcererCaptureEvidence {
  targetId: string; caseId: string; attemptId: string; equivalentSequence: 4;
  hostileAtCapture: true; ownTravelControls: number; externalCombatHelpers: 0; terminalHistoryIndex: number;
}
export interface SecretsSorcererRitualAttempt {
  id: string; targetId: string; caseId: string; mode: 'RITUAL' | 'CHALLENGE'; bottleId: string | null;
  week: number; startHistoryIndex: number; terminalHistoryIndex: number | null; closedWeek: number | null;
  outcome: 'FIGHTING' | 'SEALED' | 'ENEMY_DEAD' | 'RETREATED' | 'PLAYER_DEAD';
  travelSuccesses: number; captureAttempts: number; consumedBottleId: string | null;
  captureEvidence: SecretsSorcererCaptureEvidence | null;
}
export interface SecretsSorcererRitualState {
  phase: SecretsSorcererRitualPhase; mode: 'RITUAL' | 'CHALLENGE'; currentTargetId: string | null;
  caseId: string | null; attemptId: string | null; bottleId: string | null; visitWeek: number | null;
  startHistoryIndex: number | null; earliestSurveyWeek: number; enemySpirituality: number;
  refraction: boolean; restraintMarks: number; consumedBottleId: string | null;
  targets: SecretsSorcererTarget[]; cases: SecretsSorcererSealCase[]; attempts: SecretsSorcererRitualAttempt[];
  leadOrdinal: number; leadRequestedWeek: number | null;
  pendingLead: null | { targetId: string; entityId: string; siteId: string; source: string; receivedWeek: number };
}
export type SecretsSorcererRitualCommand =
  | { type: 'SURVEY_RITUAL'; targetId: string } | { type: 'PREPARE_SEAL' }
  | { type: 'START_RITUAL'; bottleId: string; confirmed: true }
  | { type: 'START_CHALLENGE'; targetId: string; confirmed: true }
  | { type: 'END_RITUAL' } | { type: 'REQUEST_NEW_LEAD' } | { type: 'RECEIVE_LEAD' };
const freshBody = (): SecretsSorcererTarget['body'] => ({ health: 100, mind: 100, spirituality: 40, injuries: [], risk: 0 });
export function createSecretsSorcererRitualState(): SecretsSorcererRitualState {
  return { phase: 'UNSEEN', mode: 'RITUAL', currentTargetId: null, caseId: null, attemptId: null, bottleId: null,
    visitWeek: null, startHistoryIndex: null, earliestSurveyWeek: 0, enemySpirituality: 0, refraction: false,
    restraintMarks: 0, consumedBottleId: null, cases: [], attempts: [], leadOrdinal: 0, leadRequestedWeek: null, pendingLead: null,
    targets: ['A', 'B', 'C'].map((letter, i) => ({ id: `SS4-ARCH-${letter}`, entityId: `SS4-BEAST-${letter}`,
      name: `磁门折光兽${['甲', '乙', '丙'][i]}`, siteId: `SS4-ARCH-${letter}`,
      source: '持照档案馆的三个独立原石拱记录（原创G）；当前活体、敌意、位格和通路须本人现场勘察。',
      status: 'UNSURVEYED', surveyedWeek: null, hostileVerified: false, equivalentSequence: 4, body: freshBody() })) };
}
export function currentSecretsSorcererAttempt(s: SliceState): SecretsSorcererRitualAttempt | null {
  const r = s.secretsSorcerer.ritual; return r.attempts.find(a => a.id === r.attemptId) ?? null;
}
export function currentSecretsSorcererTarget(s: SliceState): SecretsSorcererTarget | null {
  const r = s.secretsSorcerer.ritual; return r.targets.find(t => t.id === r.currentTargetId) ?? null;
}
export function currentSecretsSorcererCase(s: SliceState): SecretsSorcererSealCase | null {
  const r = s.secretsSorcerer.ritual; return r.cases.find(c => c.id === r.caseId) ?? null;
}
export function hasSecretsSorcererRitualLock(s: SliceState): boolean {
  return ['SURVEYED', 'PREPARED', 'FIGHTING', 'SEALED', 'FINISHED'].includes(s.secretsSorcerer.ritual.phase);
}
export function hasSecretsSorcererOpponent(s: SliceState): boolean {
  const r = s.secretsSorcerer?.ritual, c = s.combat;
  if (!r || !c || c.encounterId !== 'SECRETS_SORCERER_RITUAL' || c.enemyStatus !== 'RESISTING' || c.enemyHealth <= 0 || c.enemyMind <= 0 ||
    s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
    s.progression.pathwayId !== 'door' || ![5, 4].includes(s.progression.sequence ?? 0) || r.phase !== 'FIGHTING' ||
    r.visitWeek !== s.week || r.startHistoryIndex === null || s.combatHistory.length - r.startHistoryIndex !== c.round - 1 || otherPracticeOpen(s)) return false;
  const a = currentSecretsSorcererAttempt(s), t = currentSecretsSorcererTarget(s), box = currentSecretsSorcererCase(s);
  return !!a && !!t && !!box && a.outcome === 'FIGHTING' && a.closedWeek === null && a.targetId === t.id && a.caseId === box.id &&
    a.week === s.week && a.startHistoryIndex === r.startHistoryIndex && t.status === 'ENGAGED' && t.hostileVerified &&
    t.surveyedWeek === s.week && box.custody === 'PLAYER' && box.location === 'FLOOR' && box.targetId === null && box.attemptId === a.id &&
    r.enemySpirituality >= 0 && r.enemySpirituality <= 40 && r.restraintMarks >= 0 && r.restraintMarks <= 2 &&
    ((r.mode === 'RITUAL' && s.progression.sequence === 5) || (r.mode === 'CHALLENGE' && s.progression.sequence === 4)) &&
    s.combatHistory.slice(r.startHistoryIndex).every((h, i) => h.round === i + 1 && h.winner !== null && h.retreat !== 'SUCCESS' && h.secretsSorcererOutcome?.attemptId === a.id);
}
export function validateSecretsSorcererRitualCommand(value: unknown): value is SecretsSorcererRitualCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>, type = String(c.type);
  if (!['SURVEY_RITUAL', 'PREPARE_SEAL', 'START_RITUAL', 'START_CHALLENGE', 'END_RITUAL', 'REQUEST_NEW_LEAD', 'RECEIVE_LEAD'].includes(type)) return false;
  const keys = ['type'];
  if (type === 'SURVEY_RITUAL' || type === 'START_CHALLENGE') { if (typeof c.targetId !== 'string' || !c.targetId.length || c.targetId.length > 240) return false; keys.push('targetId'); }
  if (type === 'START_RITUAL') { if (typeof c.bottleId !== 'string' || !c.bottleId.length || c.bottleId.length > 240) return false; keys.push('bottleId'); }
  if (type === 'START_RITUAL' || type === 'START_CHALLENGE') { if (c.confirmed !== true) return false; keys.push('confirmed'); }
  return Object.keys(c).every(k => keys.includes(k));
}
function otherPracticeOpen(s: SliceState): boolean {
  const l=s.secretsSorcerer.life;
  return hasTravelerOpenPractice(s) || Object.values(s.apprentice.cases).some(c=>c.position==='INSIDE') ||
    [s.apprentice.cases,s.trickmaster.cases,s.astrologer.cases].some(cases=>Object.values(cases).some(c=>c.status==='PREPARED')) ||
    l.room.position==='INSIDE'||l.room.hidden||l.banishment.location==='AWAY'||l.banishment.restrained||Object.values(l.cases).some(c=>c.contactOpen||c.status==='PREPARED');
}
const unused = (t: SecretsSorcererTarget): boolean => t.status === 'UNSURVEYED' || t.status === 'AVAILABLE';
export function secretsSorcererRitualCommandReason(s: SliceState, c: SecretsSorcererRitualCommand): string | null {
  if (!validateSecretsSorcererRitualCommand(c)) return '命令无效；实际开战需要独立明确确认。';
  const r = s.secretsSorcerer.ritual;
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || s.activeEvent || s.world.city !== 'BACKLUND' || s.progression.pathwayId !== 'door' || ![5, 4].includes(s.progression.sequence ?? 0)) return '须本人清醒存活、实际在贝克兰德并已为旅行家或秘法师。';
  if (s.combat) return '战斗中只能真实迎战或沿原出口撤退，不能直接归还封箱。';
  if (c.type === 'END_RITUAL') return ['SURVEYED', 'PREPARED', 'SEALED', 'FINISHED'].includes(r.phase) ? null : '没有尚待实际退出的原石拱现场。';
  if (otherPracticeOpen(s)) return '先沿原路收束旧旅行、同伴、原木牌、记录接触与当前生活现场。';
  if (!s.secretsSorcerer.guidanceKnown) return '先向原持照档案员学习封印与晋升指导。';
  if (c.type !== 'RECEIVE_LEAD' && s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REQUEST_NEW_LEAD') return !['UNSEEN', 'CLOSED'].includes(r.phase) ? '先实际退出本场。' : r.targets.some(unused) ? '原登记还有未挑战个体，先调查这些真实来源。' : r.pendingLead || r.leadRequestedWeek !== null ? '已有待领取或待调查的线索。' : null;
  if (c.type === 'RECEIVE_LEAD') return !['UNSEEN', 'CLOSED'].includes(r.phase) ? '先实际退出本场。' : r.pendingLead || r.leadRequestedWeek === null || s.week <= r.leadRequestedWeek ? '下一真实周才能取得一条尚未核实的新地点线索。' : null;
  if (c.type === 'SURVEY_RITUAL') {
    const t = r.targets.find(t => t.id === c.targetId);
    return !['UNSEEN', 'CLOSED'].includes(r.phase) ? '先结束原现场，不能覆盖尚未归还的原封箱。' : s.week < r.earliestSurveyWeek ? '下一真实周才能挑战另一个原个体。' : (!t || !unused(t)) && r.pendingLead?.targetId !== c.targetId ? '该原个体已挑战、封存或死亡，不会刷新。' : null;
  }
  if (c.type === 'PREPARE_SEAL') return r.phase !== 'SURVEYED' || r.visitWeek !== s.week ? '先本人现场勘察这个原活体。' : s.cash < 300 ? '借领并布置一只原1级框箱需要300便士。' : null;
  const t = currentSecretsSorcererTarget(s), box = currentSecretsSorcererCase(s);
  if (r.phase !== 'PREPARED' || r.visitWeek !== s.week || !t || t.status !== 'AVAILABLE' || !t.hostileVerified || !box || box.custody !== 'PLAYER' || box.location !== 'FLOOR' || box.targetId !== null || box.charges !== 3 || box.attemptId !== null) return '须原活敌与已由本人放在石拱前2米的空原框箱，不能借旧封存目标或库存封箱。';
  if (c.type === 'START_CHALLENGE') return s.progression.sequence !== 4 || c.targetId !== t.id ? '只有秘法师可对当前已调查原个体开始非晋升实战。' : null;
  if (s.progression.sequence !== 5 || s.progression.acting !== 100 || s.traveler.promotionWeek === null || s.week - s.traveler.promotionWeek < 12) return '须本人旅行家扮演100，且晋升后实际满12周。';
  if (s.health <= 20 || s.mind <= 40) return '开战前需健康高于20、精神高于40；真实战斗没有保命下限。';
  const bottle = s.secretsSorcerer.bottles.find(b => b.id === c.bottleId);
  return !bottle || bottle.status !== 'PLAYER' || bottle.ritualAttemptId !== null ? '须本人持有未使用且未绑定旧场的同一原瓶。' : null;
}
export function handleSecretsSorcererRitualCommand(s: SliceState, c: SecretsSorcererRitualCommand, _ctx?: SeerContext): { error?: string; message?: string } {
  const reason = secretsSorcererRitualCommandReason(s, c); if (reason) return { error: reason };
  const r = s.secretsSorcerer.ritual;
  if (c.type === 'END_RITUAL') {
    const box = currentSecretsSorcererCase(s), a = currentSecretsSorcererAttempt(s);
    if (box) { box.location = 'ARCHIVE'; box.custody = 'ARCHIVE'; box.returnedWeek = s.week; }
    if (a) { a.closedWeek = s.week; r.earliestSurveyWeek = s.week + 1; }
    r.phase = 'CLOSED'; r.visitWeek = null; r.refraction = false; r.restraintMarks = 0;
    return { message: box?.targetId ? `本人提起已闭合的同一原框箱${box.id}，沿原地面出口走到8米界外，交还奥尔德伦。原敌${box.targetId}仍活着、敌对并封在同一箱内，保留封条与余量；本次关闭，未喝的原瓶仍归本人。`
      : '本人沿已核实地面出口离开，将同一空原框箱实际交还原档案员。若已撤退，框箱是在那次成功撤退时一并带出的；不隔空取箱、不复活或刷新原敌，未用原瓶保留。' };
  }
  if (c.type !== 'RECEIVE_LEAD') s.actionsRemaining -= 1;
  if (c.type === 'REQUEST_NEW_LEAD') { r.leadRequestedWeek = s.week; return { message: '付1行动请求档案巡查，下一真实周领取一条未核实线索；此刻没有生成新敌人。' }; }
  if (c.type === 'RECEIVE_LEAD') { r.leadOrdinal += 1; const id = `${s.runId}:SS4-LEAD-${r.leadOrdinal}`;
    r.pendingLead = { targetId: `${id}:ARCH`, entityId: `${id}:BEAST`, siteId: `${id}:ARCH`, source: `第${r.leadOrdinal}次持照巡查的另一原石拱目击记录（G）；尚未核实位格、敌意和原活体`, receivedWeek: s.week };
    r.leadRequestedWeek = null; return { message: '取得一条尚未核实的独立原石拱线索；另付调查行动才会知道实际原活体与通路。' }; }
  if (c.type === 'SURVEY_RITUAL') {
    if (r.pendingLead?.targetId === c.targetId) { const l = r.pendingLead; r.targets.push({ id: l.targetId, entityId: l.entityId, siteId: l.siteId, source: l.source, name: `新石拱磁门折光兽${r.leadOrdinal}`, status: 'UNSURVEYED', surveyedWeek: null, hostileVerified: false, equivalentSequence: 4, body: freshBody() }); r.pendingLead = null; }
    const t = r.targets.find(t => t.id === c.targetId)!; t.status = 'AVAILABLE'; t.surveyedWeek = s.week; t.hostileVerified = true;
    r.currentTargetId = t.id; r.caseId = null; r.attemptId = null; r.bottleId = null; r.startHistoryIndex = null; r.consumedBottleId = null;
    r.phase = 'SURVEYED'; r.mode = s.progression.sequence === 4 ? 'CHALLENGE' : 'RITUAL'; r.visitWeek = s.week; r.enemySpirituality = t.body.spirituality; r.refraction = false; r.restraintMarks = 0;
    return { message: `本人勘察${t.siteId}，实际看到原磁门折光兽朝本人施展刃切威吓，明确敌意与序列4等价位格。原身体健康${t.body.health}、精神${t.body.mind}、有限灵性${t.body.spirituality}；2米干燥侧落点与原返程已核实，地面出口通向8米固有界外。档案员与警戒者均留在出口外，不代打或捕获。` };
  }
  if (c.type === 'PREPARE_SEAL') {
    s.cash -= 300; const id = `SS4-CASE-${r.cases.length + 1}`; r.caseId = id;
    r.cases.push({ id, grade: 1, capacity: 1, charges: 3, custody: 'PLAYER', location: 'FLOOR', targetId: null, sealsIntact: false, preparedWeek: s.week, returnedWeek: null, attemptId: null }); r.phase = 'PREPARED';
    return { message: `付300便士借领原1级框箱${id}，本人携至已核实原石拱前2米地面并亲手布置。容量仅1个原目标、3次封合余量；箱不攻击、不抓人、不减势，必须本人先真实限制目标，再付6灵性与2精神尝试封入。` };
  }
  const t = currentSecretsSorcererTarget(s)!, box = currentSecretsSorcererCase(s)!, ritual = c.type === 'START_RITUAL';
  r.mode = ritual ? 'RITUAL' : 'CHALLENGE'; r.bottleId = ritual ? c.bottleId : null; r.startHistoryIndex = s.combatHistory.length;
  r.attemptId = `${s.runId}:SS4-ATTEMPT-${r.attempts.length + 1}`; r.phase = 'FIGHTING'; t.status = 'ENGAGED'; box.attemptId = r.attemptId;
  r.attempts.push({ id: r.attemptId, targetId: t.id, caseId: box.id, mode: r.mode, bottleId: r.bottleId, week: s.week,
    startHistoryIndex: r.startHistoryIndex, terminalHistoryIndex: null, closedWeek: null, outcome: 'FIGHTING', travelSuccesses: 0, captureAttempts: 0, consumedBottleId: null, captureEvidence: null });
  s.combat = { encounterId: 'SECRETS_SORCERER_RITUAL', round: 1, enemyHealth: t.body.health, enemyMind: t.body.mind,
    enemyInjuries: t.body.injuries.map(i => ({ ...i })), enemyRisk: t.body.risk, enemyStatus: 'RESISTING', lastRound: null };
  return { message: `本人走入原交战点。${ritual ? '开始独立确认的晋升封印战，服药仍需另行确认' : '开始序列4可选实战，不构成新晋升仪式'}：原兽1250位格、40上限且不自动恢复的灵性；本人仅用已有旅行、真实旧记录与同一原箱。没有外援代打、保证捕获或战斗保命。` };
}
/** Public dispatcher wrapper follows the other domain command APIs. */
export function applySecretsSorcererRitualCommand(s: SliceState, c: SecretsSorcererRitualCommand, ctx: SeerContext): void {
  const result = handleSecretsSorcererRitualCommand(s, c, ctx); if (result.error) throw new Error(result.error); if (result.message) ctx.note('原石拱封印现场', result.message);
}
export function settleSecretsSorcererRitual(s: SliceState, outcome: string, ctx?: SeerContext): void {
  const r = s.secretsSorcerer.ritual, c = s.combat, a = currentSecretsSorcererAttempt(s), t = currentSecretsSorcererTarget(s), box = currentSecretsSorcererCase(s);
  if (!c || c.encounterId !== 'SECRETS_SORCERER_RITUAL' || r.phase !== 'FIGHTING' || !a || !t || !box) throw new Error('缺少当前原石拱、原兽、原框箱与真实场次。');
  t.body = { health: c.enemyHealth, mind: c.enemyMind, spirituality: r.enemySpirituality, injuries: c.enemyInjuries.map(i => ({ ...i })), risk: c.enemyRisk };
  if (outcome === 'CONTINUE') return;
  if (!c.lastRound || !['ENEMY_SEALED', 'ENEMY_DEAD', 'RETREATED', 'PLAYER_DEAD'].includes(outcome) ||
    (outcome === 'ENEMY_SEALED' && (t.status !== 'SEALED' || box.targetId !== t.id || !box.sealsIntact || !a.captureEvidence || c.lastRound.winner !== 'PLAYER')) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0)) ||
    (outcome === 'RETREATED' && c.lastRound.retreat !== 'SUCCESS') || (outcome === 'PLAYER_DEAD' && s.health !== 0)) throw new Error('原身体与真实末轮结局不一致。');
  a.terminalHistoryIndex = s.combatHistory.length - 1;
  a.outcome = outcome === 'ENEMY_SEALED' ? 'SEALED' : outcome as 'ENEMY_DEAD' | 'RETREATED' | 'PLAYER_DEAD';
  t.status = outcome === 'ENEMY_SEALED' ? 'SEALED' : outcome === 'ENEMY_DEAD' ? 'DEAD' : 'LEFT_ALIVE';
  r.phase = outcome === 'ENEMY_SEALED' ? 'SEALED' : outcome === 'PLAYER_DEAD' ? 'LOST' : 'FINISHED';
  if (outcome === 'RETREATED') box.location = 'PLAYER';
  if (outcome === 'PLAYER_DEAD') { a.closedWeek = s.week; r.visitWeek = null; }
  s.combat = null; r.refraction = false; r.restraintMarks = 0;
  ctx?.note('原石拱真实结局', outcome === 'ENEMY_SEALED' ? '同一敌对原半神生物活着封入同一原框箱。剩余行动立即停止，没有追加伤势判定；可另行确认服药或直接沿原地面出口归还封箱，保持序列5。'
    : outcome === 'ENEMY_DEAD' ? '原兽真实死亡，尸体不满足封印活体仪式；原瓶未用，须本人取回空原箱并实际退出。'
    : outcome === 'RETREATED' ? '本人在这次成功撤退中提起原空框箱，沿原地面出口退出8米界。原兽仍活着，原健康、伤势与有限灵性留档；再交还同一箱即可收束。'
    : '本人在实际战斗中死亡，无指导保命。原兽真实余量与地面原箱保留。');
}
export function canConsumeSecretsSorcererRitual(s: SliceState, bottleId: string): string | null {
  const r = s.secretsSorcerer.ritual, a = currentSecretsSorcererAttempt(s), t = currentSecretsSorcererTarget(s), box = currentSecretsSorcererCase(s), b = s.secretsSorcerer.bottles.find(b => b.id === bottleId);
  const e = a?.captureEvidence, h = e ? s.combatHistory[e.terminalHistoryIndex] : null;
  return r.phase !== 'SEALED' || r.mode !== 'RITUAL' || s.combat || s.activeEvent || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || s.progression.pathwayId !== 'door' || s.progression.sequence !== 5 ||
    !a || a.outcome !== 'SEALED' || a.closedWeek !== null || a.consumedBottleId !== null || a.bottleId !== bottleId || r.bottleId !== bottleId ||
    !b || b.status !== 'PLAYER' || b.ritualAttemptId !== null || !t || t.status !== 'SEALED' || t.body.health <= 0 || !t.hostileVerified ||
    !box || box.targetId !== t.id || box.custody !== 'PLAYER' || box.location !== 'FLOOR' || !box.sealsIntact ||
    !e || e.targetId !== t.id || e.caseId !== box.id || e.attemptId !== a.id || e.equivalentSequence !== 4 || e.hostileAtCapture !== true || e.externalCombatHelpers !== 0 || e.ownTravelControls < 2 ||
    h?.winner !== 'PLAYER' || h.retreat !== 'NONE' || h.secretsSorcererOutcome?.enemyStatus !== 'SEALED' || h.secretsSorcererOutcome.targetId !== t.id || h.secretsSorcererOutcome.attemptId !== a.id || h.secretsSorcererOutcome.caseId !== box.id
    ? '须本场本人主要以自身力量真实封入仍活着且敌对的原半神，同一原箱封条完好，并使用本场未消费原瓶；击杀、撤退、旧封箱或场外援助不能代替。' : null;
}
export function markSecretsSorcererPotionConsumed(s: SliceState, bottleId: string): void {
  const r = s.secretsSorcerer.ritual, a = currentSecretsSorcererAttempt(s), b = s.secretsSorcerer.bottles.find(b => b.id === bottleId);
  if (r.phase !== 'SEALED' || !a || a.bottleId !== bottleId || a.consumedBottleId !== null || b?.status !== 'CONSUMED' || b.ritualAttemptId !== a.id) throw new Error('只能登记本场已经消费的同一原瓶。');
  a.consumedBottleId = bottleId; r.consumedBottleId = bottleId;
}
export interface SecretsSorcererRitualProjection {
  phase: SecretsSorcererRitualPhase; mode: 'RITUAL' | 'CHALLENGE'; currentTargetId: string | null; targetName: string;
  status: string; story: string; source: string; equipment: string; currentVisit: boolean;
  enemyHealth: number | null; enemyMind: number | null; enemySpirituality: number | null; hostileVerified: boolean;
  refraction: boolean; restraintMarks: number; caseId: string | null; charges: number | null; caseStatus: string;
  captureEvidence: string | null; consumedBottleId: string | null; attempts: number; pendingLead: string | null;
  targets: { id: string; name: string; site: string; status: string }[]; actions: SecretsSorcererAction[];
}
export function secretsSorcererRitualActions(s: SliceState): SecretsSorcererAction[] {
  const r = s.secretsSorcerer.ritual, actions: SecretsSorcererAction[] = [];
  const add = (c: SecretsSorcererRitualCommand, label: string, cost: string) => { const reason = secretsSorcererRitualCommandReason(s, c); actions.push({ id: `ritual:${c.type}:${'targetId' in c ? c.targetId : 'bottleId' in c ? c.bottleId : ''}`, label, cost, enabled: !reason, reason, command: c }); };
  if (['UNSEEN', 'CLOSED'].includes(r.phase)) {
    for (const t of r.targets.filter(unused)) add({ type: 'SURVEY_RITUAL', targetId: t.id }, `本人勘察${t.siteId}`, '1行动');
    if (r.pendingLead) add({ type: 'SURVEY_RITUAL', targetId: r.pendingLead.targetId }, '现场勘察新原石拱线索', '1行动');
    if (!r.targets.some(unused) && !r.pendingLead) add(r.leadRequestedWeek === null ? { type: 'REQUEST_NEW_LEAD' } : { type: 'RECEIVE_LEAD' }, r.leadRequestedWeek === null ? '查询另一独立原石拱' : '领取未核实地点线索', r.leadRequestedWeek === null ? '1行动 / 下一真实周' : '0行动');
  }
  if (r.phase === 'SURVEYED') add({ type: 'PREPARE_SEAL' }, '借领并亲手布置原1级框箱', '1行动 / 300便士');
  if (r.phase === 'PREPARED') {
    if (s.progression.sequence === 4 && r.currentTargetId) add({ type: 'START_CHALLENGE', targetId: r.currentTargetId, confirmed: true }, '确认开始原半神可选实战', '1行动 / 有真实死亡风险');
    else for (const b of s.secretsSorcerer.bottles.filter(b => b.status === 'PLAYER')) add({ type: 'START_RITUAL', bottleId: b.id, confirmed: true }, `确认携原瓶开始封印战：${b.id}`, '1行动 / 有真实死亡风险');
  }
  if (['SURVEYED', 'PREPARED', 'SEALED', 'FINISHED'].includes(r.phase)) add({ type: 'END_RITUAL' }, '沿原出口退出并交还同一框箱', '0行动 / 可保持当前序列');
  return actions;
}
export function projectSecretsSorcererRitual(s: SliceState): SecretsSorcererRitualProjection {
  const r = s.secretsSorcerer.ritual, t = currentSecretsSorcererTarget(s), box = currentSecretsSorcererCase(s), a = currentSecretsSorcererAttempt(s);
  const phases: Record<SecretsSorcererRitualPhase, string> = { UNSEEN: '未现场调查', SURVEYED: '原敌意与实际退路已核实', PREPARED: '同一原框箱已亲手布置', FIGHTING: '真实交战中', SEALED: '原活敌已真实封入', FINISHED: '战斗结束，仍待交还原箱', CLOSED: '已实际退出并归还', LOST: '本人真实死亡' };
  const labels: Record<SecretsSorcererTarget['status'], string> = { UNSURVEYED: '尚未本人核实', AVAILABLE: '原活敌已核实', ENGAGED: '原身体交战中', LEFT_ALIVE: '仍活着，真实伤势留档', DEAD: '原身体永久死亡', SEALED: '同一原活敌封存中' };
  return { phase: r.phase, mode: r.mode, currentTargetId: r.currentTargetId, targetName: t?.name ?? '尚无现场核实的原活敌', status: phases[r.phase],
    story: '本人主要依靠已有力量，先在真实交战中两次以成对短旅行取得受限位置，再尝试把明确敌对的序列4等价原活体封进原1级框箱。原框箱只收容已经受限的原目标，不代打或抓取；失败和死亡都真实发生。生物、场地、器具与数值均为原创G。',
    source: t?.source ?? '三处相互独立的原石拱档案；原敌意、法术、落点和出口必须实地核实。',
    equipment: '仅一只原1级框箱，容量1、初始3次封合；每次有效封合尝试另付6灵性与2精神。本人真实旧记录一次消耗，不获赠样本。' + (t?.surveyedWeek ? '已现场核实原敌刃切2灵性、折光4、错位5；40灵性有限且无自动恢复。' : '原敌的实际位格、身体与法术余量须本人勘察，不预先揭示。'),
    currentVisit: hasSecretsSorcererRitualLock(s), enemyHealth: t?.surveyedWeek ? s.combat?.enemyHealth ?? t.body.health : null,
    enemyMind: t?.surveyedWeek ? s.combat?.enemyMind ?? t.body.mind : null, enemySpirituality: t?.surveyedWeek ? r.enemySpirituality : null,
    hostileVerified: t?.hostileVerified ?? false, refraction: r.refraction, restraintMarks: r.restraintMarks, caseId: box?.id ?? null, charges: box?.charges ?? null,
    caseStatus: box ? `${box.custody === 'ARCHIVE' ? '已交还档案馆' : box.location === 'FLOOR' ? '本人布置在原地面' : '本人实际携带'}；${box.targetId ? `原目标${box.targetId}仍在箱内，封条${box.sealsIntact ? '完好' : '失效'}` : '原箱空置'}` : '尚未借领原箱',
    captureEvidence: a?.captureEvidence ? `${a.captureEvidence.targetId}，同一原箱${a.captureEvidence.caseId}；真实本人限制${a.captureEvidence.ownTravelControls}次、外援0、敌意明确` : null,
    consumedBottleId: r.consumedBottleId, attempts: r.attempts.length, pendingLead: r.pendingLead?.source ?? (r.leadRequestedWeek === null ? null : '查询已提出，等下一真实周领取'),
    targets: r.targets.map(t => ({ id: t.id, name: t.surveyedWeek === null ? '未核实原石拱目击' : `${t.name}（原创G，序列4等价）`, site: t.siteId, status: labels[t.status] })), actions: secretsSorcererRitualActions(s) };
}

const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const nullableString = (v: unknown): boolean => v === null || str(v);
const week = (v: unknown, s: SliceState): boolean => v === null || (integer(v, s.week) && v >= 1);
const shape = (v: unknown, keys: string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join('|') === keys.sort().join('|');
export function validateSecretsSorcererRitualState(s: SliceState): boolean {
  const r = s.secretsSorcerer?.ritual;
  if (!r || !shape(r, ['phase','mode','currentTargetId','caseId','attemptId','bottleId','visitWeek','startHistoryIndex','earliestSurveyWeek','enemySpirituality','refraction','restraintMarks','consumedBottleId','targets','cases','attempts','leadOrdinal','leadRequestedWeek','pendingLead']) ||
    !['UNSEEN','SURVEYED','PREPARED','FIGHTING','SEALED','FINISHED','CLOSED','LOST'].includes(r.phase) || !['RITUAL','CHALLENGE'].includes(r.mode) ||
    ![r.currentTargetId,r.caseId,r.attemptId,r.bottleId,r.consumedBottleId].every(nullableString) || !week(r.visitWeek,s) || !week(r.leadRequestedWeek,s) ||
    !integer(r.earliestSurveyWeek) || !integer(r.enemySpirituality,40) || !integer(r.restraintMarks,2) || typeof r.refraction !== 'boolean' ||
    !(r.startHistoryIndex === null || integer(r.startHistoryIndex,s.combatHistory.length)) || !integer(r.leadOrdinal) ||
    !Array.isArray(r.targets) || r.targets.length < 3 || !Array.isArray(r.cases) || !Array.isArray(r.attempts) || !Array.isArray(s.secretsSorcerer.bottles)) return false;
  if (new Set(r.targets.map(t=>t.id)).size !== r.targets.length || new Set(r.targets.map(t=>t.entityId)).size !== r.targets.length || new Set(r.targets.map(t=>t.siteId)).size !== r.targets.length ||
    new Set(r.cases.map(c=>c.id)).size !== r.cases.length || new Set(r.attempts.map(a=>a.id)).size !== r.attempts.length || new Set(r.attempts.map(a=>a.targetId)).size !== r.attempts.length || new Set(r.attempts.map(a=>a.caseId)).size !== r.attempts.length) return false;
  for (const [i,t] of r.targets.entries()) {
    if (!shape(t,['id','entityId','name','siteId','source','status','surveyedWeek','hostileVerified','equivalentSequence','body']) || ![t.id,t.entityId,t.name,t.siteId,t.source].every(str) || t.equivalentSequence !== 4 ||
      !['UNSURVEYED','AVAILABLE','ENGAGED','LEFT_ALIVE','DEAD','SEALED'].includes(t.status) || !week(t.surveyedWeek,s) || typeof t.hostileVerified !== 'boolean' ||
      (i<3 && (t.id!==`SS4-ARCH-${['A','B','C'][i]}` || t.entityId!==`SS4-BEAST-${['A','B','C'][i]}` || t.siteId!==t.id)) ||
      !shape(t.body,['health','mind','spirituality','injuries','risk']) || !integer(t.body.health,100) || !integer(t.body.mind,100) || !integer(t.body.spirituality,40) || !integer(t.body.risk) ||
      !Array.isArray(t.body.injuries) || t.body.injuries.some(i=>!i || !str(i.id) || !['LIGHT','HEAVY'].includes(i.severity)) ||
      (t.status==='UNSURVEYED' ? t.surveyedWeek!==null || t.hostileVerified : t.surveyedWeek===null || !t.hostileVerified) ||
      (t.status==='DEAD' ? t.body.health!==0 : t.body.health<=0)) return false;
    const a=r.attempts.find(a=>a.targetId===t.id);
    if (['ENGAGED','LEFT_ALIVE','DEAD','SEALED'].includes(t.status) ? !a : !!a) return false;
    if(t.status==='SEALED' && !r.cases.some(c=>c.targetId===t.id && c.sealsIntact))return false;
  }
  for(const [i,c] of r.cases.entries()) {
    if(!shape(c,['id','grade','capacity','charges','custody','location','targetId','sealsIntact','preparedWeek','returnedWeek','attemptId']) || c.id!==`SS4-CASE-${i+1}` || c.grade!==1 || c.capacity!==1 || !integer(c.charges,3) ||
      !['PLAYER','ARCHIVE'].includes(c.custody) || !['FLOOR','PLAYER','ARCHIVE'].includes(c.location) || !nullableString(c.targetId) || !nullableString(c.attemptId) || typeof c.sealsIntact!=='boolean' ||
      !week(c.preparedWeek,s) || c.preparedWeek===null || !week(c.returnedWeek,s) || (c.custody==='ARCHIVE' ? c.location!=='ARCHIVE'||c.returnedWeek===null : c.location==='ARCHIVE'||c.returnedWeek!==null) ||
      (c.targetId!==null ? !c.sealsIntact || !r.targets.some(t=>t.id===c.targetId&&t.status==='SEALED') : c.sealsIntact))return false;
    const a=r.attempts.find(a=>a.id===c.attemptId); if(c.attemptId!==null&&(!a||a.caseId!==c.id))return false;
    if(a&&c.charges!==3-a.captureAttempts)return false;
  }
  for(const a of r.attempts) {
    if(!shape(a,['id','targetId','caseId','mode','bottleId','week','startHistoryIndex','terminalHistoryIndex','closedWeek','outcome','travelSuccesses','captureAttempts','consumedBottleId','captureEvidence']) ||
      ![a.id,a.targetId,a.caseId].every(str) || !['RITUAL','CHALLENGE'].includes(a.mode) || !nullableString(a.bottleId) || !nullableString(a.consumedBottleId) || !week(a.week,s) || a.week===null ||
      !integer(a.startHistoryIndex,s.combatHistory.length) || !week(a.closedWeek,s) || !integer(a.travelSuccesses) || !integer(a.captureAttempts,3) ||
      !['FIGHTING','SEALED','ENEMY_DEAD','RETREATED','PLAYER_DEAD'].includes(a.outcome) || !r.targets.some(t=>t.id===a.targetId) || !r.cases.some(c=>c.id===a.caseId&&c.attemptId===a.id))return false;
    if(a.mode==='RITUAL' ? !s.secretsSorcerer.bottles.some(b=>b.id===a.bottleId) : a.bottleId!==null||a.consumedBottleId!==null)return false;
    if(a.outcome==='FIGHTING') {if(a.id!==r.attemptId||r.phase!=='FIGHTING'||a.terminalHistoryIndex!==null||a.closedWeek!==null||a.captureEvidence!==null)return false;}
    else {
      if(!integer(a.terminalHistoryIndex,s.combatHistory.length-1)||a.terminalHistoryIndex<a.startHistoryIndex)return false;
      const rows=s.combatHistory.slice(a.startHistoryIndex,a.terminalHistoryIndex+1),last=rows.at(-1)!,f=last.secretsSorcererOutcome,t=r.targets.find(t=>t.id===a.targetId)!;
      if(!rows.every((h,i)=>h.round===i+1&&h.winner!==null&&h.secretsSorcererOutcome?.attemptId===a.id&&h.secretsSorcererOutcome.targetId===a.targetId&&h.secretsSorcererOutcome.caseId===a.caseId&&(i===rows.length-1||h.retreat!=='SUCCESS')) ||
        !f||f.enemyHealth!==t.body.health||f.enemyMind!==t.body.mind||f.enemySpirituality!==t.body.spirituality||f.charges!==3-a.captureAttempts)return false;
      if(a.outcome==='SEALED') {
        const e=a.captureEvidence;
        if(!shape(e,['targetId','caseId','attemptId','equivalentSequence','hostileAtCapture','ownTravelControls','externalCombatHelpers','terminalHistoryIndex'])||!e||e.targetId!==a.targetId||e.caseId!==a.caseId||e.attemptId!==a.id||e.equivalentSequence!==4||e.hostileAtCapture!==true||e.externalCombatHelpers!==0||e.ownTravelControls!==a.travelSuccesses||e.ownTravelControls<2||e.terminalHistoryIndex!==a.terminalHistoryIndex||f.enemyStatus!=='SEALED'||f.restraintMarks!==2||t.status!=='SEALED'||last.winner!=='PLAYER'||last.retreat!=='NONE'||typeof last.consequenceRoll==='number')return false;
      }else if(a.captureEvidence!==null || (a.outcome==='ENEMY_DEAD'&&f.enemyStatus!=='DEAD') || (a.outcome==='RETREATED'&&last.retreat!=='SUCCESS'))return false;
    }
    if(a.consumedBottleId!==null&&!s.secretsSorcerer.bottles.some(b=>b.id===a.consumedBottleId&&b.id===a.bottleId&&b.status==='CONSUMED'&&b.ritualAttemptId===a.id))return false;
  }
  if(r.pendingLead!==null && (!shape(r.pendingLead,['targetId','entityId','siteId','source','receivedWeek']) || ![r.pendingLead.targetId,r.pendingLead.entityId,r.pendingLead.siteId,r.pendingLead.source].every(str) || !week(r.pendingLead.receivedWeek,s) || r.pendingLead.receivedWeek===null || r.leadRequestedWeek!==null || r.targets.some(t=>t.id===r.pendingLead!.targetId)))return false;
  const a=currentSecretsSorcererAttempt(s),t=currentSecretsSorcererTarget(s),box=currentSecretsSorcererCase(s);
  if(r.currentTargetId!==null&&!t || r.caseId!==null&&!box || r.attemptId!==null&&!a || a&&(a.targetId!==r.currentTargetId||a.caseId!==r.caseId||a.bottleId!==r.bottleId||a.startHistoryIndex!==r.startHistoryIndex||a.consumedBottleId!==r.consumedBottleId))return false;
  if(r.phase==='FIGHTING')return hasSecretsSorcererOpponent(s) && t!.body.health===s.combat!.enemyHealth && t!.body.mind===s.combat!.enemyMind && t!.body.spirituality===r.enemySpirituality;
  if(s.combat?.encounterId==='SECRETS_SORCERER_RITUAL')return false;
  if(r.phase==='SEALED'&&(!a||a.outcome!=='SEALED'||a.closedWeek!==null||!box||!box.sealsIntact||box.custody!=='PLAYER'||box.location!=='FLOOR'||t?.status!=='SEALED'))return false;
  if(['SURVEYED','PREPARED','SEALED','FINISHED'].includes(r.phase) ? r.visitWeek!==s.week : r.visitWeek!==null)return false;
  if(r.phase==='PREPARED'&&(!box||box.attemptId!==null||box.charges!==3||box.custody!=='PLAYER'||t?.status!=='AVAILABLE'))return false;
  if(r.phase==='CLOSED'&&((a&&a.closedWeek===null)||(box&&box.custody!=='ARCHIVE')))return false;
  return true;
}
