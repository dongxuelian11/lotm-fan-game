import { addGameDays, compareGameDates, formatGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { ERROR_RITUAL_CANDIDATE as C, ERROR_RITUAL_CUSTODIAN as K, ERROR_RITUAL_INNER as INNER,
  ERROR_RITUAL_LIGHT as LIGHT, ERROR_RITUAL_PAST, ERROR_RITUAL_SITE as SITE,
  ERROR_RITUAL_SUN as SUN, ERROR_RITUAL_SUN_UNIQUE as SU, ERROR_RITUAL_TERMS as P,
  ERROR_RITUAL_THUNDER as THUNDER, ERROR_RITUAL_TYRANT as TU } from './ritual-content.js';
import { ERROR_RITUAL_ORIGINALS, ERROR_RITUAL_UNIQUE, type ErrorRitualCommand,
  type ErrorRitualEffect, type ErrorRitualHost, type ErrorRitualResult, type ErrorRitualState,
  type ErrorRitualCheckInput, type ErrorRitualPastEvent, type ErrorRitualWorldChange,
  type MemberRange, type RitualBody, type RitualObject } from './ritual-types.js';
export * from './ritual-types.js';

const clone = <T>(v: T): T => structuredClone(v);
const need = (v: unknown, message: string): void => { if (!v) throw Error(message); };
const integer = (v: number, min = 0): boolean => Number.isSafeInteger(v) && v >= min;
const dead = (b: Pick<RitualBody, 'health' | 'mental' | 'pollution'>): boolean => b.health <= 0 || b.mental <= 0 || b.pollution >= 100;
const blank = (): ErrorRitualEffect => ({ cashCost: 0, actions: 0, spirituality: 0, mental: 0, health: 0, pollution: 0,
  seconds: 0, heavyInjuries: 0, promoted: false, died: false });
function object(s: ErrorRitualState, id: string): RitualObject {
  const found = s.objects.find(o => o.id === id); if (!found) throw Error('缺少同一原物。'); return found;
}
function log(s: ErrorRitualState, id: string, second: number, text: string): void {
  need(!s.journal.some(e => e.id === id), '同一世界事件不能再执行。'); s.journal.push({ id, second, text });
}
function debit(b: RitualBody, cost: { health: number; mental: number; pollution: number }): void {
  b.health = Math.max(0, b.health - cost.health); b.mental = Math.max(0, b.mental - cost.mental);
  b.pollution = Math.min(100, b.pollution + cost.pollution); b.heavyInjuries++;
  if (dead(b)) b.health = 0;
}
function initialObjects(ids: readonly string[], predecessor: string): RitualObject[] {
  return ids.map(id => ({ id, owner: predecessor, holder: predecessor, place: `${predecessor}-BODY`, state: 'EMBODIED' }));
}
/** The tiny history reducer only understands this finite original branch. */
function enactPast(s: ErrorRitualState, e: ErrorRitualPastEvent): void {
  const last = s.history.at(-1); need(!last || compareGameDates(last.date, e.date) <= 0, '原历史日期不得倒流。');
  need(!s.history.some(h => h.id === e.id), '历史事件不得复制。');
  if (e.kind === 'PREDECESSOR_DIED') {
    const sun = e.predecessor === 'SUN', holder = sun ? 'ER219-PRIOR-SUN' : 'ER219-PRIOR-TYRANT';
    need(sun ? s.predecessors.sunAlive : s.predecessors.tyrantAlive, '前任不能重复死亡。');
    if (sun) s.predecessors.sunAlive = false; else s.predecessors.tyrantAlive = false;
    for (const o of s.objects.filter(o => o.holder === holder)) { o.state = 'EXPOSED'; o.place = `${holder}-REMAINS`; }
  } else if (e.kind === 'HANDOVER') {
    const buyer = e.owner === C ? s.candidate : e.owner === SUN ? s.sun : null;
    if (e.price) { need(buyer && buyer.cash >= e.price, '历史取得须支付本人现有金钱。'); buyer!.cash -= e.price; }
    for (const id of e.objects) {
      const o = object(s, id); need(o.holder === e.from && o.state !== 'EMBODIED' && o.state !== 'FUSED', '历史交接须取得同一外置原物。');
      o.owner = e.owner; o.holder = e.to; o.place = e.place; o.state = 'SEALED';
    }
  } else if (e.kind === 'EMBODY_FIRST') {
    const actor = e.actor === 'SUN' ? SUN : C, o = object(s, e.object);
    need(o.holder === actor && o.owner === actor && o.state === 'SEALED', '须实际取得第一份原物后才可容纳。');
    o.state = 'EMBODIED'; o.place = `${actor}-BODY`;
  } else if (e.kind === 'SUN_ASCENDED') {
    need(!s.predecessors.sunAlive && object(s, LIGHT[0]).state === 'EMBODIED', '太阳原神位与序列1前置不成立。');
    for (const id of [...LIGHT, SU]) { const o = object(s, id); need(o.owner === SUN && o.holder === SUN, '太阳必须拥有同三份和唯一性。'); o.state = 'FUSED'; o.place = `${SUN}-BODY`; }
    s.sun.sequence = 0; s.sun.health = 1000; s.sun.spirituality = 10000;
  } else if (e.kind === 'COHORT') {
    for (const cohort of s.cohorts) {
      cohort[e.state] = e.members.map(r => [r[0], r[1]]);
      cohort.events.push({ id: e.id, kind: e.state, ranges: clone(cohort[e.state]) });
    }
  } else if (e.kind === 'CHALLENGE') {
    need(s.sun.sequence === 0 && !dead(s.sun) && [...LIGHT, SU].every(id => object(s, id).state === 'FUSED'), '对手须真实容纳太阳0原物且仍在世。');
    need(!s.challenge.escaped && s.challenge.assistingActors.length === 0 && s.challenge.position === e.from, '单独挑战必须沿同一真实通道连续行动。');
    need(s.challenge.started || e.playerAttack, '第一交换必须是候选人主动攻击。');
    need(s.candidate.spirituality >= e.candidateSpiritualityCost && s.sun.spirituality >= e.sunSpiritualityCost, '双方须实付有限灵性。');
    s.candidate.health -= e.candidateHealthLoss; s.candidate.spirituality -= e.candidateSpiritualityCost;
    s.sun.health -= e.sunHealthLoss; s.sun.spirituality -= e.sunSpiritualityCost;
    need(!dead(s.candidate) && !dead(s.sun), '本分支历史要求双方实际存活，不能由结果标签复活。');
    s.challenge.started = true; s.challenge.position = e.to; s.challenge.metres += Math.abs(e.to - e.from);
    s.challenge.exchangeIds.push(e.id); if (e.candidateHealthLoss >= 10) s.candidate.heavyInjuries++;
    if (e.breaksContact) { need(e.to === 60 && s.challenge.metres === 60, '只有实际走到出口并撑过截击才能脱离。');
      s.challenge.escaped = true; s.challenge.healthOnEscape = s.candidate.health; }
  } else if (e.kind === 'CARE') {
    need(s.candidate.cash >= e.price && s.candidate.heavyInjuries > 0 && e.restSeconds === 57600, '治疗须有原伤、实付款和两段真实休养。');
    s.candidate.cash -= e.price; s.candidate.health = Math.min(100, s.candidate.health + e.healthGain);
    s.candidate.spirituality = Math.min(120, s.candidate.spirituality + e.spiritualityGain); s.candidate.heavyInjuries = 0;
  } else s.candidate.intendsAscension = true;
  s.history.push(clone(e));
}
export function createErrorRitual(input: Pick<ErrorRitualHost, 'actorId' | 'date' | 'nowSecond'>): ErrorRitualState {
  need(!!input.actorId.trim() && integer(input.nowSecond), '须提供同一本人的实际身份和世界时间。');
  need(compareGameDates(input.date, ERROR_RITUAL_PAST.at(-1)!.date) >= 0, '当前日期早于这段历史。');
  const body = (): RitualBody => ({ health: 100, mental: 100, spirituality: 120, pollution: 0, heavyInjuries: 0, cash: 30000 });
  const s: ErrorRitualState = { version: 1, actorId: input.actorId, lastSecond: input.nowSecond, history: [],
    candidate: { ...body(), id: C, name: '伊德里克·维尔', sequence: 1, status: 'ACTIVE', place: 'ER219-COASTAL-HALL', intendsAscension: false, contact: false, seals: 2, isolation: 0 },
    sun: { ...body(), id: SUN, sequence: 1, status: 'ACTIVE' }, predecessors: { sunAlive: true, tyrantAlive: true },
    objects: [...initialObjects([...LIGHT, SU], 'ER219-PRIOR-SUN'), ...initialObjects([...THUNDER, TU], 'ER219-PRIOR-TYRANT')],
    cohorts: (['NORTH', 'EAST', 'SOUTH'] as const).map((id, i) => ({ id, prefix: ['NC', 'EC', 'SC'][i]!, fear: [], obey: [], believe: [], events: [] })),
    challenge: { participants: [C, SUN], assistingActors: [], started: false, escaped: false, position: 0, metres: 0, healthOnEscape: null, exchangeIds: [] },
    oathRing: { id: 'ER219-OATH-RING', holder: C, worn: true, linked: false },
    conductor: { id: 'ER219-CONDUCTOR', intact: true, condition: 100, version: 1, originalPrayerLink: true },
    custodian: { id: K, status: 'ACTIVE', canAct: true, place: 'ER219-TYRANT-VAULT', pathOpen: true, cash: 30, spirituality: 8, chestUses: 1, recoveryDue: null, recoveryObjectIds: [], recoveredAt: null },
    guard: { id: 'ER219-TOWER-GUARD', status: 'ACTIVE', positionMetres: 0, dispatchedAt: null, cutAt: null, cut: false },
    booking: null, phase: 'UNBOOKED', consumedAt: null, candidateOutcome: null, candidateSettledAt: null,
    player: { position: 'OUTSIDE', walkedMetres: 0, surveyed: false, surveyEventId: null, observedConductorVersion: null, linePrepared: false,
      lineConnected: false, lineCondition: 100, exposure: 0, grip: { id: 'ER219-GRIP', holder: 'MAKER', boughtEventId: null }, attemptedAt: null, outcome: null }, journal: [] };
  for (const e of ERROR_RITUAL_PAST) enactPast(s, e);
  return s;
}
/** Three identity intersections, never the sum of unrelated population counts. */
export function errorRitualPopulation(s: ErrorRitualState): number {
  return s.cohorts.reduce((total, c) => total + c.fear.reduce((a, f) => a + c.obey.reduce((b, o) =>
    b + c.believe.reduce((n, belief) => n + Math.max(0, Math.min(f[1], o[1], belief[1]) - Math.max(f[0], o[0], belief[0]) + 1), 0), 0), 0), 0);
}
export function errorCandidateIneligible(s: ErrorRitualState): string | null {
  if (s.predecessors.tyrantAlive || !s.candidate.intendsAscension || s.candidate.sequence !== 1 || dead(s.candidate)) return '独立候选人或空缺神位已不成立。';
  if (errorRitualPopulation(s) < 200000) return '同一批人的恐惧、服从和信仰交集已不足二十万。';
  if (!s.challenge.escaped || s.challenge.metres !== 60 || (s.challenge.healthOnEscape ?? 0) <= 0 || s.challenge.assistingActors.length || s.challenge.exchangeIds.length !== 4) return '未完成独自挑战真实太阳0并存活的原事件链。';
  if (object(s, THUNDER[0]).holder !== C || object(s, THUNDER[0]).state !== 'EMBODIED' ||
      ![THUNDER[1], THUNDER[2], TU].every(id => { const o = object(s, id); return o.owner === C &&
        (o.holder === K && o.state === 'SEALED' || o.holder === C && o.state === 'VESSEL' && o.place === INNER); })) return '候选人的同三份雷神和暴君唯一性不齐。';
  if (s.candidate.health < 80 || s.candidate.mental < 70 || s.candidate.spirituality < 30 || s.candidate.heavyInjuries) return '候选人当前身体不足以开始独立仪式。';
  return null;
}
function exposeCandidate(s: ErrorRitualState): void {
  for (const id of dead(s.candidate) ? [...THUNDER, TU] : [THUNDER[1], THUNDER[2], TU]) {
    const o = object(s, id); o.state = 'EXPOSED'; o.holder = INNER; o.place = INNER;
  }
}
function recoveryPossible(s: ErrorRitualState): boolean {
  return s.custodian.status === 'ACTIVE' && s.custodian.canAct && s.custodian.place === INNER && s.custodian.pathOpen &&
    s.custodian.chestUses === 1 && s.custodian.cash >= P.recoveryCash && s.custodian.spirituality >= P.recoverySpirituality &&
    [THUNDER[1], THUNDER[2], TU].every(id => object(s, id).state === 'EXPOSED' && object(s, id).place === INNER);
}
function finishCandidate(s: ErrorRitualState, second: number, displaced: boolean): void {
  if (s.candidateOutcome !== null) return;
  // A fixed independent bodily policy, not a second player-controlled roll.
  const succeeds = !displaced && !dead(s.candidate) && s.candidate.health >= 80 && s.candidate.mental >= 70 &&
    s.candidate.pollution < 40 && s.candidate.spirituality >= 20 && s.conductor.intact && s.candidate.contact &&
    s.candidate.place === INNER && errorRitualPopulation(s) >= 200000;
  if (succeeds) {
    for (const id of [...THUNDER, TU]) { const o = object(s, id); o.state = 'FUSED'; o.holder = C; o.place = `${C}-BODY`; }
    s.candidate.sequence = 0; s.candidateOutcome = 'ASCENDED';
  } else {
    debit(s.candidate, s.candidate.pollution >= 65 || s.candidate.mental <= 20 ? P.severeFailure : P.failure);
    s.candidate.status = dead(s.candidate) ? 'DEAD' : 'ACTIVE';
    s.candidateOutcome = displaced ? dead(s.candidate) ? 'DISPLACED_DEAD' : 'DISPLACED_ALIVE' : dead(s.candidate) ? 'DEAD' : 'FAILED_ALIVE';
    exposeCandidate(s);
    if (recoveryPossible(s)) {
      s.custodian.cash -= P.recoveryCash; s.custodian.spirituality -= P.recoverySpirituality;
      s.custodian.chestUses = 0; s.custodian.recoveryDue = second + P.recoverySeconds;
      s.custodian.recoveryObjectIds = s.objects.filter(o => o.state === 'EXPOSED' && o.place === INNER).map(o => o.id);
      log(s, 'ER219-RECOVERY-START', second, '海伦亲手接触原内厅残留，实付30便士与8灵性，打开唯一封存箱；600秒收拢尚未完成。');
    }
  }
  s.phase = 'SETTLED'; s.candidateSettledAt = second; s.candidate.contact = false; s.oathRing.linked = false;
  if (!s.player.outcome) s.player.outcome = 'MISSED';
  log(s, 'ER219-CANDIDATE-SETTLED', second, s.candidateOutcome === 'ASCENDED' ? '伊德里克独立完成同一次暴君晋升；神位已被他实际占据。' :
    `${displaced ? '伊德里克被夺走真实仪式位置' : '伊德里克自己的融合失败'}；当前健康${s.candidate.health}、精神${s.candidate.mental}、污染${s.candidate.pollution}。原物留在其身体或原内厅，未交给玩家。`);
}
/** Call after EVERY accepted host action (including NEXT_WEEK, travel and death).
 * No wall clock, readiness-triggered reschedule or new attempt is created here. */
export function advanceErrorRitual(previous: ErrorRitualState, toSecond: number): ErrorRitualState {
  need(integer(toSecond) && toSecond >= previous.lastSecond, '仪式世界时间不得倒流。');
  const s = clone(previous);
  for (;;) {
    const b = s.booking;
    const phaseDue = !b ? Infinity : s.phase === 'BOOKED' ? b.consumeAt - P.assemblySeconds :
      s.phase === 'ASSEMBLING' ? b.consumeAt - 10 : s.phase === 'CONTACT' ? b.consumeAt :
      s.phase === 'CONSUMING' ? b.consumeAt + P.windowEnd : Infinity;
    const cutDue = !s.guard.cut && s.guard.cutAt !== null ? s.guard.cutAt : Infinity;
    const recoverDue = s.custodian.recoveryDue ?? Infinity;
    const due = Math.min(phaseDue, cutDue, recoverDue); if (!Number.isFinite(due) || due > toSecond) break;
    if (due === cutDue) {
      s.guard.cut = true;
      if (s.guard.status === 'ACTIVE') { s.guard.positionMetres = 6; s.player.lineConnected = false; s.player.lineCondition = 0;
        log(s, 'ER219-GUARD-CUT', due, '守卫实际走完6米并剪断外侧接线；群众与内厅的原祷告导体没有被剪断。'); }
    } else if (due === recoverDue) {
      s.custodian.recoveryDue = null;
      if (s.custodian.status === 'ACTIVE' && s.custodian.canAct && s.custodian.place === INNER && s.custodian.pathOpen &&
          s.custodian.recoveryObjectIds.length >= 3 && s.custodian.recoveryObjectIds.every(id => object(s, id).state === 'EXPOSED' && object(s, id).place === INNER)) {
        for (const o of s.custodian.recoveryObjectIds.map(id => object(s, id))) { o.state = 'SEALED'; o.holder = K; o.place = 'ER219-TYRANT-SEALING-CHEST'; }
        s.custodian.recoveredAt = due; log(s, 'ER219-RECOVERY-DONE', due, '海伦用同一个已耗封存箱完成600秒收拢，同一外置残留现归其实际保管；活人体内原特性没有移走。');
      } else log(s, 'ER219-RECOVERY-BLOCKED', due, '收拢遭实际阻断；成本已付，未移动的原残留仍暴露在内厅原容器处。');
    } else if (s.phase === 'BOOKED') {
      const reason = errorCandidateIneligible(s);
      if (reason || !s.custodian.pathOpen || s.custodian.status !== 'ACTIVE' || !s.custodian.canAct) {
        s.phase = 'CANCELLED'; s.candidateOutcome = 'INELIGIBLE'; s.candidateSettledAt = due;
        if (!s.player.outcome) s.player.outcome = 'MISSED'; log(s, 'ER219-CANCELLED', due, reason ?? '真实运输被阻断，唯一日程取消；不能重新预约。');
      } else {
        s.candidate.place = INNER; s.custodian.place = INNER;
        for (const id of [THUNDER[1], THUNDER[2], TU]) { const o = object(s, id); o.holder = C; o.place = INNER; o.state = 'VESSEL'; }
        s.phase = 'ASSEMBLING'; log(s, 'ER219-ASSEMBLY', due, '海伦实际运输并向在内厅的伊德里克交出其原两份雷神和暴君唯一性，置入唯一原容器。');
      }
    } else if (s.phase === 'ASSEMBLING') {
      s.candidate.contact = s.conductor.intact && s.candidate.place === INNER && !dead(s.candidate) && s.oathRing.holder === C && s.oathRing.worn;
      s.oathRing.linked = s.candidate.contact;
      s.phase = 'CONTACT'; log(s, 'ER219-CANDIDATE-CONTACT', due, '伊德里克将自己仍戴着的铜誓环扣在群众祷告的原导体上；原联系真实通向内厅本人。');
    } else if (s.phase === 'CONTACT') {
      const reason = errorCandidateIneligible(s);
      if (reason || !s.conductor.intact || !s.candidate.contact) { s.phase = 'CANCELLED'; s.candidateOutcome = 'INELIGIBLE'; s.candidateSettledAt = due;
        if (!s.player.outcome) s.player.outcome = 'MISSED'; log(s, 'ER219-CANCELLED', due, reason ?? '原联系断开，真实仪式未能开始，机会永久关闭。'); }
      else { s.phase = 'CONSUMING'; s.consumedAt = due; s.candidate.spirituality -= 30;
        log(s, 'ER219-CONSUMED', due, '伊德里克实际饮用自己的两份雷神与暴君唯一性；从此刻起18至30秒是唯一未完成融合的窗口。'); }
    } else finishCandidate(s, due, false);
  }
  if (s.guard.dispatchedAt !== null && !s.guard.cut) s.guard.positionMetres = Math.min(6, Math.max(0, toSecond - s.guard.dispatchedAt));
  s.lastSecond = toSecond; return s;
}

export function validateErrorRitualCommand(value: unknown): value is ErrorRitualCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>, keys = Object.keys(c).sort().join('|');
  return c.type === 'REPLACE' ? keys === 'confirmed|type' && c.confirmed === true :
    keys === 'type' && ['BRIEF', 'SURVEY', 'PREPARE_LINE', 'ENTER', 'WAIT_FOR_CHANT', 'RETREAT'].includes(String(c.type));
}
export function errorRitualCost(s: ErrorRitualState, c: ErrorRitualCommand, h: ErrorRitualHost): ErrorRitualEffect {
  const e = blank();
  if (c.type === 'BRIEF') e.seconds = 60;
  if (c.type === 'SURVEY') { e.actions = 1; e.seconds = P.surveySeconds; }
  if (c.type === 'PREPARE_LINE') { e.actions = 1; e.cashCost = P.linePrice; e.seconds = P.lineSeconds; }
  if (c.type === 'ENTER' || c.type === 'RETREAT') e.seconds = P.walkSeconds;
  if (c.type === 'WAIT_FOR_CHANT') e.seconds = Math.max(0, (s.booking?.consumeAt ?? h.nowSecond) + P.windowStart - h.nowSecond);
  if (c.type === 'REPLACE') { e.actions = P.actions; e.spirituality = P.spirituality; e.mental = P.mental; e.seconds = P.actionSeconds; }
  return e;
}
function playerMaterialReason(h: ErrorRitualHost): string | null {
  const c = h.compound, p = h.preparation;
  if (!c || c.status !== 'PREPARED' || c.id !== 'error-ascent-compound-1' || c.carrierId !== 'error-ascent-carrier-1' ||
    c.location !== h.location || c.uniquenessId !== ERROR_RITUAL_UNIQUE ||
    !ERROR_RITUAL_ORIGINALS.includes(c.embodiedOriginalId) || c.externalOriginalIds.length !== 2 ||
    new Set([c.embodiedOriginalId, ...c.externalOriginalIds]).size !== 3 ||
    !c.externalOriginalIds.every(id => ERROR_RITUAL_ORIGINALS.includes(id))) return '须本人携带同一原载体、两份外置时之虫及错误唯一性，体内仍是另一本人原特性。';
  if (!p || p.status !== 'READY' || p.actorId !== h.actorId || p.compoundId !== c.id || p.expiresSecond < h.nowSecond + P.actionSeconds)
    return '同一本人的原剂须有仍覆盖完整四秒动作的付费稳定准备。';
  return null;
}
export function errorRitualBlock(previous: ErrorRitualState, c: ErrorRitualCommand, h: ErrorRitualHost): string | null {
  if (!validateErrorRitualCommand(c)) return '只能提交调查、准备、进入、等待、替位或普通撤回意图。';
  if (h.actorId !== previous.actorId || !integer(h.nowSecond) || h.nowSecond < previous.lastSecond ||
      previous.journal.some(e => e.id === `${h.eventId}:PLAYER`)) return '本人、世界时间或动作事件不匹配。';
  if (h.status !== 'ACTIVE' || h.health <= 0 || h.mental <= 0 || h.pollution >= 100) return '本人已死亡；由世界时钟结算独立候选人。';
  const s = advanceErrorRitual(previous, h.nowSecond);
  // The ordinary six-metre stair is available to every living entrant, even
  // after failure, success, expired preparation, zero cash or zero actions.
  if (c.type === 'RETREAT') return s.player.position !== 'OUTER_CONTACT' ? '本人已在普通外侧出口。' : null;
  if (h.sequence !== 1 || h.location !== SITE) return '本人须亲自到潮汐钟塔，且仍为序列1时之虫。';
  if (s.player.outcome !== null || s.phase === 'SETTLED' || s.phase === 'CANCELLED') return '这一次机会已经结束；不能补发候选人或重开窗口。';
  if (s.player.attemptedAt !== null) return '同一替位只允许一次实际尝试。';
  const cost = errorRitualCost(s, c, h);
  if (h.cash < cost.cashCost || h.actionPoints < cost.actions || h.spirituality < cost.spirituality || h.mental <= cost.mental)
    return '本次公开费用、行动、灵性或精神不足。';
  if (c.type === 'BRIEF') return s.booking ? '候选人的唯一日程已确定，不再重订。' :
    !h.bookingPlan || !integer(h.bookingPlan.leadSeconds, P.assemblySeconds + 60) || !integer(h.nowSecond + h.bookingPlan.leadSeconds) || !h.bookingPlan.routeSummary.trim() ||
      (h.bookingPlan.consumeDate !== undefined && compareGameDates(h.bookingPlan.consumeDate, h.date) < 0) ? '尚无按当前资源和真实行动计算的可行路线与运输日期。' : null;
  if (!s.booking) return '先听取当前集会安排；确定一次实际日程。';
  if (c.type === 'SURVEY') return s.player.position !== 'OUTSIDE' || s.player.surveyed ? '走查只能从外侧进行一次。' :
    !s.conductor.intact ? '原祷告导体已断，不能核实可用联系。' : null;
  if (c.type === 'PREPARE_LINE') return !s.player.surveyed || s.player.position !== 'OUTSIDE' ? '先实地走查原线路和普通退路。' :
    s.player.linePrepared ? '同一外接线路已经准备，不重复收费。' :
    s.player.grip.holder !== 'MAKER' ? '同一原握环已交接，不能重复购买。' : null;
  if (c.type === 'ENTER') return !s.player.surveyed || !s.player.linePrepared || s.player.position !== 'OUTSIDE' ? '先走查、准备同一外线，再实际进入6米检修位。' :
    !s.conductor.intact || s.player.lineCondition <= 0 || s.guard.cut ? '同一线路已被真实破坏，无法重新生成。' : null;
  if (c.type === 'WAIT_FOR_CHANT') return s.player.position !== 'OUTER_CONTACT' ? '先亲自到检修接触位。' :
    h.nowSecond >= s.booking.consumeAt + P.windowStart ? '开场吟唱已结束，窗口不会因等待重开。' : null;
  if (s.phase !== 'CONSUMING' || s.consumedAt === null || h.nowSecond < s.consumedAt + P.windowStart ||
    h.nowSecond + P.actionSeconds > s.consumedAt + P.windowEnd) return '必须在实际饮用后第18至30秒内完整进行4秒动作。';
  if (s.player.position !== 'OUTER_CONTACT' || !s.player.lineConnected || !s.conductor.intact || !s.candidate.contact ||
      s.candidate.place !== INNER || !s.oathRing.linked || s.oathRing.holder !== C || !s.oathRing.worn || dead(s.candidate) || s.guard.cut || s.player.lineCondition <= 0) return '本人、候选人及原祷告联系必须真实在场并保持连通。';
  if (s.guard.cutAt !== null && s.guard.cutAt <= h.nowSecond + P.actionSeconds) return '守卫会在四秒动作完成前剪断同一外线；已没有完整接触时间。';
  const rivalReason = errorCandidateIneligible(s); if (rivalReason) return rivalReason;
  if (h.health < 80 || h.mental < 70 || h.injuries.length) return '先恢复到80健康、70精神并解除现有伤势；旧伤不能用风险零代替治疗。';
  return playerMaterialReason(h);
}
/** Forecast exactly the finite response that REPLACE will enact before its check. */
function resistance(s: ErrorRitualState): number {
  const fresh = s.guard.dispatchedAt === null;
  return s.candidate.isolation + (fresh && s.candidate.spirituality >= P.resistanceSpirituality ? 6 : 0) +
    (fresh && s.candidate.seals > 0 ? 4 : 0) + s.player.exposure * 3 + (s.guard.positionMetres >= 4 ? 3 : 0) +
    Math.ceil((100 - s.conductor.condition) / 10);
}
export function getErrorRitualCheckInput(previous: ErrorRitualState, h: ErrorRitualHost): ErrorRitualCheckInput {
  const s = advanceErrorRitual(previous, h.nowSecond);
  return { ability: 'will', baseAbility: h.will, difficulty: P.difficulty, modifiers: [
    { source: '同一原剂的有效付费稳定准备', value: h.preparation && h.preparation.expiresSecond >= h.nowSecond + P.actionSeconds ? P.stabilizationBonus : 0 },
    { source: '实际原线与普通退路走查', value: s.player.surveyed ? 4 : 0 },
    { source: '同一实备外接线路', value: s.player.linePrepared ? 4 : 0 },
    { source: '当前身体与精神', value: Math.max(-10, Math.min(4, Math.floor((h.health - 80) / 10) + Math.floor((h.mental - 80) / 10))) },
    { source: '候选人隔离、有限封签、守卫和原线损耗', value: -resistance(s) },
  ] };
}
function oppose(s: ErrorRitualState, second: number): void {
  if (s.guard.dispatchedAt !== null || dead(s.candidate) || s.candidate.place !== INNER) return;
  const spiritualCost = Math.min(P.resistanceSpirituality, s.candidate.spirituality);
  // Only a fully funded isolation action grants its full resistance.
  if (spiritualCost === P.resistanceSpirituality) { s.candidate.spirituality -= spiritualCost; s.candidate.isolation += 6; }
  const sealSpent = s.candidate.seals > 0;
  if (sealSpent) { s.candidate.seals--; s.candidate.isolation += 4; }
  s.guard.dispatchedAt = second; s.guard.cutAt = second + P.guardSeconds;
  log(s, 'ER219-REAL-RESISTANCE', second, `伊德里克发现真实外接异常，实耗${spiritualCost === P.resistanceSpirituality ? spiritualCost : 0}自身灵性与${sealSpent ? 1 : 0}枚自己的原封签强化隔离；守卫沿6米实路赶来，8秒后剪断外接线。剩余灵性${s.candidate.spirituality}、封签${s.candidate.seals}。`);
}
export function applyErrorRitual(previous: ErrorRitualState, c: ErrorRitualCommand, h: ErrorRitualHost): ErrorRitualResult {
  const reason = errorRitualBlock(previous, c, h); if (reason) throw Error(reason);
  if (c.type === 'REPLACE') {
    need(h.check !== null, '替位必须使用中央随机流给出的本次普通判定。');
    const expected = resolveNormalCheck({ ...getErrorRitualCheckInput(previous, h), roll: h.check!.roll });
    need(stableStringify(expected) === stableStringify(h.check), '中央判定必须匹配本人当前意志、准备和实际抵抗；不得提交成功布尔。');
  } else need(h.check === null, '普通动作不接受替位检定或额外随机抽取。');
  let s = advanceErrorRitual(previous, h.nowSecond);
  const e = errorRitualCost(s, c, h), notes: string[] = []; let settlement: ErrorRitualResult['settlement'] = null;
  if (c.type === 'BRIEF') {
    const plan = h.bookingPlan!;
    const date = plan.consumeDate ?? addGameDays(h.date, Math.floor(((h.nowSecond % 86400) + plan.leadSeconds) / 86400));
    s.booking = { eventId: h.eventId, bookedAt: h.nowSecond, consumeAt: h.nowSecond + plan.leadSeconds,
      date: clone(date), routeSummary: plan.routeSummary }; s.phase = 'BOOKED';
    notes.push(`集会运输落实为${formatGameDate(date)}，世界第${s.booking.consumeAt}秒开始饮用。${plan.routeSummary}。这是唯一日程，之后不因本人进出、准备或撤回而改变。`);
  } else if (c.type === 'SURVEY') {
    s.player.surveyed = true; s.player.surveyEventId = h.eventId; s.player.observedConductorVersion = s.conductor.version;
    notes.push(`你亲自核对候选人的经历，确认同一${errorRitualPopulation(s)}人的三项经历，沿原祷告导体找到外侧检修接点，并实际走查6米普通楼梯退路。尚未接通或饮用。`);
  } else if (c.type === 'PREPARE_LINE') {
    s.player.linePrepared = true; s.player.grip.holder = 'PLAYER'; s.player.grip.boughtEventId = h.eventId;
    if (s.phase !== 'BOOKED') s.player.exposure++;
    notes.push('实际付30便士从钟塔器材匠取得唯一普通握环，另耗20便士线路耗材，准备同一外侧检修支线；尚未接通本人，不耗旧人的封签。');
  } else if (c.type === 'ENTER') {
    if (s.phase === 'CONSUMING') s.player.exposure++;
    // Arrival is applied after the real six seconds below.
    notes.push('本人实际走到外侧6米检修位，持握自己的原握环接入同一祷告联系。内厅候选人没有同意，也未交出其材料。');
  } else if (c.type === 'WAIT_FOR_CHANT') notes.push('世界时间照常走过候选人的实际运输、接环与饮用，停在唯一窗口开始处；生活与周结仍由主机照常计费。');
  else if (c.type === 'RETREAT') {
    s.player.lineConnected = false;
    if (!s.player.outcome) s.player.outcome = 'WITHDRAWN';
    if (s.consumedAt !== null && s.candidateOutcome === null) e.seconds = Math.max(e.seconds, s.consumedAt + P.windowEnd - h.nowSecond);
    notes.push('本人沿原楼梯走完6米离开，不需要现金、行动点或施术。自己的未饮用原物不动；已花费用不退，同一候选人的仪式继续。');
  } else {
    s.player.attemptedAt = h.nowSecond;
    oppose(s, h.nowSecond);
    const success = h.check!.tier === 'SUCCESS' || h.check!.tier === 'GREAT_SUCCESS';
    if (success) { e.promoted = true; s.player.outcome = 'ASCENDED'; finishCandidate(s, h.nowSecond + P.actionSeconds, true); }
    else {
      const cost = h.check!.tier === 'GREAT_FAILURE' ? P.severeFailure : P.failure;
      e.health = cost.health; e.mental += cost.mental; e.pollution = cost.pollution; e.heavyInjuries = 1;
      e.died = h.health - e.health <= 0 || h.mental - e.mental <= 0 || h.pollution + e.pollution >= 100;
      s.player.outcome = e.died ? 'DEAD' : 'FAILED_ALIVE';
      // The remaining seconds are real world time. Even a dead player's ending
      // commits the rival's sole outcome, rather than freezing it in progress.
      e.seconds = Math.max(e.seconds, s.consumedAt! + P.windowEnd - h.nowSecond);
    }
    const compound = h.compound!, prep = h.preparation!;
    settlement = { eventId: h.eventId, compoundId: compound.id, carrierId: compound.carrierId, preparationId: prep.id,
      carrierSpent: true, preparationSpent: true, atSecond: h.nowSecond + P.actionSeconds, place: SITE, position: 'OUTER_CONTACT',
      embodiedOriginalId: compound.embodiedOriginalId, externalOriginalIds: [...compound.externalOriginalIds], uniquenessId: ERROR_RITUAL_UNIQUE,
      outcome: success ? 'FUSED' : e.died ? 'DEATH_RESIDUE' : 'EXPOSED_ALIVE' };
    notes.push(success ? '本人的真实四秒替位成功。只融合自己的三份时之虫与错误唯一性，成为错误0；对方原物没有进入本人。' :
      e.died ? '替位失败并触发实际死亡。本人原三份与错误唯一性统一留在外侧同一遗留现场；不再同时保留体内或瓶中副本。' :
      '替位失败且本人存活。体内原第一份保留；外置两份与错误唯一性暴露在外侧原接触位，原载体和稳定准备耗尽。可沿楼梯普通离开，不能再试。');
  }
  s = advanceErrorRitual(s, h.nowSecond + e.seconds);
  if (c.type === 'ENTER') { s.player.position = 'OUTER_CONTACT'; s.player.walkedMetres += P.walkMetres;
    s.player.lineConnected = s.conductor.intact && !s.guard.cut;
    if (s.player.exposure > 0 && s.player.lineConnected) oppose(s, s.lastSecond); }
  if (c.type === 'RETREAT') { s.player.position = 'OUTSIDE'; s.player.walkedMetres += P.walkMetres; }
  log(s, `${h.eventId}:PLAYER`, s.lastSecond, notes.join('\n'));
  return { state: s, effect: e, notes, settlement };
}

export function getErrorRitualPreparationFacts(s: ErrorRitualState, sourceDigest: string) {
  if (!s.player.surveyed || s.player.surveyEventId === null || s.player.observedConductorVersion === null) return null;
  return { actorId: s.actorId, sourceDigest, investigationEventId: s.player.surveyEventId,
    routeEventId: s.player.surveyEventId, conductorEventId: s.player.surveyEventId,
    conductorId: 'ER219-CONDUCTOR' as const, routeId: 'ER219-OUTER-STAIR' as const,
    observedConductorVersion: s.player.observedConductorVersion, currentConductorVersion: s.conductor.version,
    conductorIntact: s.conductor.intact, ordinaryExitOpen: true };
}
/** A dated internal fact alters the actual world, never a player-supplied flag. */
export function applyErrorRitualWorldChange(previous: ErrorRitualState, change: ErrorRitualWorldChange,
  second: number, eventId: string): ErrorRitualState {
  const s = advanceErrorRitual(previous, second); need(!s.journal.some(e => e.id === eventId), '世界事件不能重复。');
  if (change.type === 'COHORT_DEPARTURE') {
    need(integer(change.members[0], 1) && integer(change.members[1], change.members[0]) && change.members[1] <= 70000 && !!change.reason.trim(), '必须点明真实离开的身份区间和原因。');
    const cohort = s.cohorts.find(c => c.id === change.cohort); need(cohort, '必须是原人口名册。');
    const remove = (ranges: MemberRange[]): MemberRange[] => ranges.flatMap(([a, b]) => {
      const [x, y] = change.members; if (y < a || x > b) return [[a, b] as const];
      const next: MemberRange[] = []; if (a < x) next.push([a, x - 1]); if (b > y) next.push([y + 1, b]); return next;
    });
    for (const key of ['fear', 'obey', 'believe'] as const) cohort![key] = remove(cohort![key]);
  } else if (change.type === 'CONDUCTOR_BROKEN') {
    s.conductor.intact = false; s.conductor.condition = 0; s.conductor.version++; s.candidate.contact = false; s.oathRing.linked = false; s.player.lineConnected = false;
  } else if (change.type === 'CUSTODIAN_PATH_BLOCKED') s.custodian.pathOpen = false;
  else {
    need([change.health, change.mental, change.pollution].every(v => integer(v)), '身体变化必须是真实非负损失。');
    debit(s.candidate, change); if (dead(s.candidate)) {
      s.candidate.status = 'DEAD';
      if (s.consumedAt !== null && s.candidateOutcome === null) finishCandidate(s, second, false);
      else for (const o of s.objects.filter(o => o.holder === C && (o.state === 'EMBODIED' || o.state === 'FUSED'))) {
        o.state = 'EXPOSED'; o.holder = s.candidate.place; o.place = s.candidate.place; }
    }
  }
  log(s, eventId, second, change.type === 'COHORT_DEPARTURE' ? `${change.cohort}名册${change.members.join('至')}实际退出：${change.reason}。当前交集${errorRitualPopulation(s)}人。` : change.type === 'CONDUCTOR_BROKEN' ? '群众祷告的钟塔导体实际断裂。' : change.type === 'CUSTODIAN_PATH_BLOCKED' ? '海伦前往原容器的道路被实际堵住。' : '伊德里克受到真实伤害，当前身体与原物位置据实保留。');
  return s;
}

/** Small truthful view model; no UI integration or private history dump. */
export function projectErrorRitual(previous: ErrorRitualState, h: ErrorRitualHost) {
  const s = advanceErrorRitual(previous, h.nowSecond), start = s.consumedAt;
  const commands: ErrorRitualCommand[] = !s.booking ? [{ type: 'BRIEF' }] :
    s.player.position === 'OUTER_CONTACT' ? s.player.outcome === null ? [{ type: 'WAIT_FOR_CHANT' }, { type: 'REPLACE', confirmed: true }, { type: 'RETREAT' }] : [{ type: 'RETREAT' }] :
      !s.player.surveyed ? [{ type: 'SURVEY' }] : !s.player.linePrepared ? [{ type: 'PREPARE_LINE' }] : [{ type: 'ENTER' }];
  const labels: Record<ErrorRitualCommand['type'], string> = { BRIEF: '听取集会安排', SURVEY: '走查原线与退路', PREPARE_LINE: '准备普通外接线', ENTER: '走入检修位', WAIT_FOR_CHANT: '等到吟唱收束', REPLACE: '确认夺取仪式位置', RETREAT: '沿楼梯离开' };
  return { title: '潮汐钟塔', position: s.player.position === 'OUTSIDE' ? '普通外侧出口' : '外侧6米接触位', phase: s.phase,
    deadline: s.booking ? `${formatGameDate(s.booking.date)}，世界第${s.booking.consumeAt}秒饮用；只此一次` : '尚未落实集会运输',
    window: start === null ? '须先等候选人实际饮用' : `窗口第${start + 18}至${start + 30}秒，完整施术4秒；现在第${h.nowSecond}秒`,
    chance: errorRitualBlock(s, { type: 'REPLACE', confirmed: true }, h) === null ? computeCheckChance(getErrorRitualCheckInput(s, h)) : null,
    warning: '这是夺走他人的成神机会，可能杀死双方。30灵性、8精神、1行动与自己的原剂、载体及准备一并投入。失败另失45健康、40精神、35污染并受重伤；大失败另失110健康、100精神、70污染。离开不会重开仪式。',
    result: s.player.outcome, candidateResult: s.candidateOutcome,
    actions: commands.map(command => { const reason = errorRitualBlock(s, command, h), e = errorRitualCost(s, command, h); return {
      command, label: labels[command.type], enabled: reason === null, reason,
      cost: `${e.cashCost}便士、${e.actions}行动、${e.spirituality}灵性、${e.mental}精神、${e.seconds}秒${command.type === 'REPLACE' ? '；失败伤害另计，随后独立仪式继续结算' : ''}`,
    }; }),
  };
}

export function getErrorRitualActions(s: ErrorRitualState, h: ErrorRitualHost) {
  return projectErrorRitual(s, h).actions;
}
