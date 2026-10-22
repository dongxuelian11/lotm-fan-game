import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { DoorEffect, DoorHost } from './ports.js';
import { DOOR_EPILOGUE_POLICY as P, DOOR_EPILOGUE_SCENE as S } from './epilogue-content.js';

export const DOOR_EPILOGUE_ABILITY_IDS = ['door.s0.bounded-conceptual-escape', 'door.s0.single-exit-seal'] as const;
const [ESCAPE, SEAL] = DOOR_EPILOGUE_ABILITY_IDS;
const TYPES = ['OBSERVE', 'APPROACH_WORKER', 'RELEASE_CATCH', 'CONCEPTUAL_ESCAPE', 'FREE_WORKER',
  'OBSERVE_EXIT', 'SEAL_EXIT', 'OPEN_EXIT', 'STOP_EFFECTS', 'WAIT_WINDOW', 'ISOLATE_AND_FREE',
  'GUIDE_SIDE_EXIT', 'WITHDRAW', 'REPORT'] as const;
export type DoorEpilogueCommand = { type: typeof TYPES[number] };
type Position = 0 | 8 | 'SIDE_PASSAGE';
export interface DoorSceneInjury { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: number | null }
interface Window {
  attempted: boolean; passed: boolean; applied: boolean; targetId: string | null; targetActorId: string | null;
  conditionVersion: number | null; openedSecond: number | null; expiresSecond: number | null;
  openedEventId: string | null; appliedEventId: string | null; appliedSecond: number | null;
  endedReason: 'USED' | 'STOPPED' | 'EXPIRED' | 'MOVED' | 'EXIT_CHANGED' | 'ISOLATED' | null;
}
interface Impact {
  id: string; status: 'UNDECLARED' | 'PENDING' | 'AVOIDED' | 'HELD' | 'STRUCK' | 'MISSED' | 'MECHANICALLY_STOPPED';
  declaredEventId: string | null; declaredSecond: number | null; dueSecond: number | null;
  resolvedEventId: string | null; resolvedSecond: number | null; playerHealthLoss: number;
  workerHealthLoss: number; trolleyWear: number;
}
interface Supply { id: string; stock: 0 | 1; holder: 'SUPPLIER' | 'SPENT'; purchasedEventId: string | null; spentEventId: string | null }
export interface DoorEpilogueState {
  id: typeof S.id; actorId: string; location: typeof S.location; startedWeek: number; startedSecond: number; lastSecond: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN'; observed: boolean; reported: boolean;
  playerPosition: Position; playerMetres: number; bodyVersion: number;
  worker: { id: string; name: string; age: number; status: 'ACTIVE' | 'DEAD'; health: number; injuries: string[];
    position: Position; travelledMetres: number; consent: 'UNASKED' | 'ACCEPT'; trapped: boolean; freedEventId: string | null };
  trolley: { id: string; ownerId: string; holderId: string; condition: number; position: Position;
    travelledMetres: number; clampReleased: boolean; quantity: 1 };
  latch: { id: string; prepared: boolean; released: boolean; spring: 'TENSIONED' | 'DISCHARGED'; condition: number };
  brake: { id: string; applied: boolean; condition: number };
  counterweight: { id: string; quantity: 1; energy: 'HELD' | 'MOVING' | 'SPENT' | 'SECURED' };
  exit: { id: string; position: 12; handleId: string; handlePosition: 8; closed: boolean; condition: number; version: number; observedVersion: number | null };
  supplies: { focus: Supply; seal: Supply }; escape: Window; seal: Window;
  impacts: { spring: Impact; exit: Impact }; isolated: boolean; playerInjuries: DoorSceneInjury[];
  arrival: { eventId: string; second: number; routeId: typeof S.ordinaryExitId; workerId: string; trolleyId: string; metres: number } | null;
  journal: { eventId: string; revision: number; command: DoorEpilogueCommand; host: DoorHost; beforeSecond: number;
    afterSecond: number; effect: DoorEffect; check: PublicCheckResult | null; masteryGains: Record<string, number>; notes: string[] }[];
}
const clone = <T>(v: T): T => structuredClone(v);
const blank = (): DoorEffect => ({ cashCost: 0, cashGain: 0, actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const freshWindow = (): Window => ({ attempted: false, passed: false, applied: false, targetId: null, targetActorId: null,
  conditionVersion: null, openedSecond: null, expiresSecond: null, openedEventId: null, appliedEventId: null,
  appliedSecond: null, endedReason: null });
const freshImpact = (id: string): Impact => ({ id, status: 'UNDECLARED', declaredEventId: null, declaredSecond: null,
  dueSecond: null, resolvedEventId: null, resolvedSecond: null, playerHealthLoss: 0, workerHealthLoss: 0, trolleyWear: 0 });
const supply = (id: string): Supply => ({ id, stock: 1, holder: 'SUPPLIER', purchasedEventId: null, spentEventId: null });
const isCast = (c: DoorEpilogueCommand) => c.type === 'CONCEPTUAL_ESCAPE' || c.type === 'SEAL_EXIT';
const passed = (check: PublicCheckResult) => check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
function end(w: Window, reason: NonNullable<Window['endedReason']>) {
  if (w.expiresSecond !== null) { w.expiresSecond = null; w.endedReason = reason; }
}
const live = (w: Window, second: number) => w.passed && !w.applied && w.openedSecond !== null && w.openedSecond <= second &&
  w.expiresSecond !== null && second <= w.expiresSecond;
export function validateDoorEpilogueCommand(v: unknown): v is DoorEpilogueCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    Object.hasOwn(v, 'type') && TYPES.includes((v as DoorEpilogueCommand).type);
}
/** No source reset or old scene import. Central START_EPILOGUE must verify the
 * actual same actor's living S0 promotion and its completed three local jobs. */
export function createDoorEpilogue(input: { week: number; nowSecond: number; actorId: string }): DoorEpilogueState {
  if (typeof input.actorId !== 'string' || !input.actorId.trim() || !integer(input.week, 1) || !integer(input.nowSecond)) throw Error('必须提供同一本人的真实时间与身份。');
  return { id: S.id, actorId: input.actorId, location: S.location, startedWeek: input.week, startedSecond: input.nowSecond,
    lastSecond: input.nowSecond, status: 'ACTIVE', observed: false, reported: false, playerPosition: 0, playerMetres: 0, bodyVersion: 1,
    worker: { id: S.workerId, name: S.workerName, age: S.workerAge, status: 'ACTIVE', health: S.workerHealth,
      injuries: [S.workerInjury], position: 8, travelledMetres: 0, consent: 'UNASKED', trapped: true, freedEventId: null },
    trolley: { id: S.trolleyId, ownerId: S.workerId, holderId: S.workerId, condition: S.trolleyCondition,
      position: 8, travelledMetres: 0, clampReleased: false, quantity: 1 },
    latch: { id: S.latchId, prepared: false, released: false, spring: 'TENSIONED', condition: 82 },
    brake: { id: S.brakeId, applied: false, condition: 76 },
    counterweight: { id: S.counterweightId, quantity: 1, energy: 'HELD' },
    exit: { id: S.exitId, position: 12, handleId: S.exitHandleId, handlePosition: 8, closed: true, condition: S.exitCondition, version: 1, observedVersion: null },
    supplies: { focus: supply(S.focusId), seal: supply(S.sealId) }, escape: freshWindow(), seal: freshWindow(),
    impacts: { spring: freshImpact(S.springImpactId), exit: freshImpact(S.exitImpactId) }, isolated: false,
    playerInjuries: [], arrival: null, journal: [] };
}
export function getDoorEpilogueCheckInput(c: DoorEpilogueCommand): { ability: PublicCoreStatKey; difficulty: number; modifier: number; source: string } | null {
  const p = c.type === 'CONCEPTUAL_ESCAPE' ? P.escape : c.type === 'SEAL_EXIT' ? P.seal : null;
  return p ? { ability: p.ability, difficulty: p.difficulty, modifier: P.modifier, source: P.modifierSource } : null;
}
function actualCheck(c: DoorEpilogueCommand, h: DoorHost): void {
  const spec = getDoorEpilogueCheckInput(c);
  if (!spec) { if (h.check !== null) throw Error('普通动作不接收施术检定。'); return; }
  if (!h.check) throw Error('本次施术必须使用实际中央检定。');
  const reconstructed = resolveNormalCheck({ ability: spec.ability, baseAbility: h.check.baseAbility,
    difficulty: spec.difficulty, modifiers: [{ source: spec.source, value: spec.modifier }], roll: h.check.roll });
  if (stableStringify(reconstructed) !== stableStringify(h.check)) throw Error('实际检定与本次有限目标不一致。');
}
export function doorEpilogueCost(s: DoorEpilogueState, c: DoorEpilogueCommand, _h: DoorHost): DoorEffect {
  const e = blank();
  if (isCast(c)) Object.assign(e, c.type === 'CONCEPTUAL_ESCAPE' ? P.escape : P.seal);
  // Keep the effect contract exact: policy-only values never cross into effects.
  if (isCast(c)) return { cashCost: e.cashCost, cashGain: 0, actions: e.actions, spirituality: e.spirituality,
    mind: e.mind, health: 0, seconds: e.seconds, toLocation: null };
  switch (c.type) {
    case 'OBSERVE': e.seconds = P.observeSeconds; break;
    case 'APPROACH_WORKER': e.seconds = P.approachSeconds; break;
    case 'RELEASE_CATCH': e.seconds = P.prepareSeconds; break;
    case 'FREE_WORKER': e.seconds = P.releaseSeconds; break;
    case 'OBSERVE_EXIT': e.seconds = P.observeExitSeconds; break;
    case 'OPEN_EXIT': e.seconds = P.openExitSeconds; break;
    case 'STOP_EFFECTS': e.seconds = P.stopSeconds; break;
    case 'WAIT_WINDOW': e.seconds = P.waitSeconds; break;
    case 'ISOLATE_AND_FREE': e.seconds = P.isolateSeconds + (s.playerPosition === 0 ? P.approachSeconds : 0); break;
    case 'GUIDE_SIDE_EXIT': e.seconds = P.loadSeconds + P.sideSeconds; break;
    case 'WITHDRAW': e.seconds = s.playerPosition === 0 ? 1 : P.sideSeconds; break;
    case 'REPORT': e.seconds = P.reportSeconds; break;
  }
  return e;
}
export function doorEpilogueBlock(s: DoorEpilogueState, c: DoorEpilogueCommand, h: DoorHost): string | null {
  if (!validateDoorEpilogueCommand(c)) return '处置只能指定一个动作，不能提交成功、骰值、人物或物件替换。';
  if (h.actorId !== s.actorId || h.sequence !== 0 || h.status !== 'ACTIVE' || h.health <= 0 || h.mind <= 0 || h.location !== s.location)
    return '须同一仍存活的本人已晋升门，并实际在吊运棚。';
  if (![h.nowSecond, h.weekAnchor, h.cash, h.actions, h.health, h.mind, h.spirituality].every(n => integer(n)) ||
    !integer(h.week, s.startedWeek) || !integer(h.revision, 1) || h.nowSecond < s.lastSecond || h.nowSecond < h.weekAnchor ||
    h.nowSecond >= h.weekAnchor + 604800 || typeof h.eventId !== 'string' || !h.eventId.trim() || h.revision <= (s.journal.at(-1)?.revision ?? -1) || s.journal.some(j => j.eventId === h.eventId))
    return '真实时钟、资源、动作次序或已结算事件无效。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先实际撤离，才能交接真实结果。' : s.reported ? '本次实际结果已经交接。' : null;
  if (s.status !== 'ACTIVE') return '本次处置已经结束，伤势、原件与未救出的人仍按实际情况保留。';
  if (c.type === 'WITHDRAW' || c.type === 'STOP_EFFECTS' || c.type === 'WAIT_WINDOW') return null;
  if (c.type === 'OBSERVE') return s.observed ? '同一工人、工具车、机房门和侧道已经看清。' : null;
  if (!s.observed) return '先查看实际工人、工具车、原手刹和普通侧道。';
  if (c.type === 'ISOLATE_AND_FREE') return s.isolated ? '原手刹已实际制动卸力，不能重复消耗或补回原件。' : s.worker.status !== 'ACTIVE' ? '工人已无生命迹象，不能把普通解困写成复活。' : null;
  if (c.type === 'APPROACH_WORKER') return s.playerPosition !== 0 || !s.worker.trapped ? '只能沿原八米通道走到尚未解困的同一工人身旁。' : null;
  if (s.playerPosition !== 8) return '须本人实际走到八米维修位。';
  if (c.type === 'RELEASE_CATCH') return s.latch.prepared || s.latch.released || s.isolated ? '原卡扣已经卸力或准备过，不能重置这次反弹。' : null;
  if (c.type === 'FREE_WORKER') return !s.latch.prepared || s.latch.released || !s.worker.trapped ? '须先实际拨开原卡扣，且同一工人仍被夹住。' : null;
  if (c.type === 'OBSERVE_EXIT') return s.exit.observedVersion === s.exit.version ? '同一机房门的当前受力状态已经看清。' : null;
  if (c.type === 'OPEN_EXIT') return !s.exit.closed ? '同一机房门已经打开。' : null;
  if (c.type === 'GUIDE_SIDE_EXIT') return s.worker.trapped || s.worker.position !== 8 || s.worker.status !== 'ACTIVE' ||
    s.worker.consent !== 'ACCEPT' || !s.trolley.clampReleased || s.trolley.position !== 8 ? '须同一工人实际解困、仍愿同行，原工具车也已松开。' : null;
  if (c.type === 'CONCEPTUAL_ESCAPE' && (s.escape.attempted || s.supplies.focus.stock !== 1 || s.impacts.spring.status !== 'PENDING' ||
    s.impacts.spring.dueSecond === null || h.nowSecond + P.escape.seconds >= s.impacts.spring.dueSecond))
    return '仅可对尚未发生的本次弹簧反弹尝试一次；既有伤势不能倒改。';
  if (c.type === 'SEAL_EXIT' && (s.seal.attempted || s.supplies.seal.stock !== 1 || s.impacts.exit.status !== 'PENDING' ||
    s.impacts.exit.dueSecond === null || h.nowSecond + P.seal.seconds >= s.impacts.exit.dueSecond || !s.exit.closed || s.exit.observedVersion !== s.exit.version))
    return '仅对当前亲见且仍关闭的同一机房门尝试一次，须赶在那一次配重撞击前完成。';
  const e = doorEpilogueCost(s, c, h);
  return h.actions < e.actions ? '行动不足；原手刹卸力和普通侧道仍不耗行动。' : h.cash < e.cashCost ? `需本人实付${e.cashCost}便士；没有现金仍可普通解困。` :
    h.spirituality < e.spirituality || h.mind <= e.mind ? '实际灵性或精神不足，仍可普通卸力和离开。' : null;
}

/** Pure, finite event clock. An impact is settled at its own due time, even when
 * a longer command ends after its window. No RNG is generated in this module. */
export function applyDoorEpilogue(previous: DoorEpilogueState, c: DoorEpilogueCommand, h: DoorHost): {
  state: DoorEpilogueState; effect: DoorEffect; notes: string[]; injuries: DoorSceneInjury[]; masteryGains: Record<string, number>;
} {
  const reason = doorEpilogueBlock(previous, c, h); if (reason) throw Error(reason); actualCheck(c, h);
  const s = clone(previous), e = blank(), notes: string[] = [], injuries: DoorSceneInjury[] = [], masteryGains: Record<string, number> = {};
  const hurt = (amount: number, source: string) => {
    if (!amount) return; e.health += amount;
    const injury: DoorSceneInjury = { id: `${h.eventId}:${source}`, severity: 'LIGHT', acquiredRevision: h.revision, treatedRevision: null };
    injuries.push(injury); s.playerInjuries.push(injury);
  };
  const use = (w: Window, id: string, second: number) => {
    w.applied = true; w.appliedEventId = h.eventId; w.appliedSecond = second; end(w, 'USED'); masteryGains[id] = 8;
  };
  const settleUntil = (second: number) => {
    const pending = [s.impacts.spring, s.impacts.exit].filter(i => i.status === 'PENDING' && i.dueSecond !== null && i.dueSecond <= second)
      .sort((a, b) => a.dueSecond! - b.dueSecond!);
    for (const impact of pending) {
      const due = impact.dueSecond!; impact.resolvedEventId = h.eventId; impact.resolvedSecond = due;
      if (impact.id === s.impacts.spring.id) {
        s.latch.spring = 'DISCHARGED';
        const applied = s.playerPosition === 8 && live(s.escape, due) && s.escape.targetId === impact.id &&
          s.escape.targetActorId === s.actorId && s.escape.conditionVersion === s.bodyVersion;
        if (applied) { impact.status = 'AVOIDED'; use(s.escape, ESCAPE, due);
          notes.push(`弹簧在第${due}秒真实反弹。仅本人避开已指定的这一次冲击，工具车、艾达和原挫伤未改变；技巧掌握增8。`); }
        else if (s.playerPosition === 8) { impact.status = 'STRUCK'; impact.playerHealthLoss = P.springHealthLoss;
          hurt(P.springHealthLoss, 'door-spring-injury'); notes.push(`原弹簧反弹实际击中本人，损失${P.springHealthLoss}健康并留下轻伤；事后施术不能取消。`); }
        else { impact.status = 'MISSED'; notes.push('原弹簧按时反弹，但本人已实走离开受力位置；没有施术应用或掌握收益。'); }
      } else {
        s.counterweight.energy = 'SPENT';
        const applied = s.exit.closed && live(s.seal, due) && s.seal.targetId === s.exit.id && s.seal.conditionVersion === s.exit.version;
        if (applied) { impact.status = 'HELD'; s.exit.condition -= P.heldDoorWear; use(s.seal, SEAL, due);
          notes.push(`配重在第${due}秒实际推撞同一机房门；短封锁抵住这一次推力后耗尽，原门仍磨损${P.heldDoorWear}，技巧掌握增8。侧道从未被封住。`); }
        else {
          impact.status = 'STRUCK'; s.exit.closed = false; s.exit.condition = Math.max(0, s.exit.condition - P.exitDoorWear);
          if (s.playerPosition === 8) { impact.playerHealthLoss = P.exitPlayerHealthLoss; hurt(P.exitPlayerHealthLoss, 'door-exit-injury'); }
          if (s.worker.position === 8) { impact.workerHealthLoss = P.exitWorkerHealthLoss; s.worker.health = Math.max(0, s.worker.health - P.exitWorkerHealthLoss);
            s.worker.injuries.push('同一机房门撞击造成的新挫伤'); if (!s.worker.health) s.worker.status = 'DEAD'; }
          if (s.trolley.position === 8) { impact.trolleyWear = P.exitTrolleyWear; s.trolley.condition = Math.max(0, s.trolley.condition - P.exitTrolleyWear); }
          notes.push(`原配重真实落下，机房门被推开并磨损${P.exitDoorWear}。本人损失${impact.playerHealthLoss}健康，艾达损失${impact.workerHealthLoss}，原工具车磨损${impact.trolleyWear}；已经走入侧道的人与车不会被隔空击中。`);
        }
        s.exit.version++; s.exit.observedVersion = null; end(s.seal, 'EXIT_CHANGED');
      }
    }
    for (const w of [s.escape, s.seal]) if (w.expiresSecond !== null && second > w.expiresSecond) end(w, 'EXPIRED');
  };
  let cursor = h.nowSecond;
  const advance = (seconds: number) => { cursor += seconds; settleUntil(cursor); };
  const alive = () => h.health > e.health && h.mind > e.mind;
  const leaveBay = () => { s.playerPosition = 'SIDE_PASSAGE'; s.bodyVersion++; end(s.escape, 'MOVED'); };
  const declare = (i: Impact, delay: number) => { i.status = 'PENDING'; i.declaredEventId = h.eventId;
    i.declaredSecond = cursor; i.dueSecond = cursor + delay; };
  const freeWorker = (mechanical: boolean) => {
    s.worker.trapped = false; s.worker.freedEventId = h.eventId; s.trolley.clampReleased = true;
    s.latch.released = true; s.latch.condition--; notes.push('亲手松开同一原卡扣，艾达的原衣袖和工具车得到释放；人和车仍在八米维修位，旧伤不变。');
    if (!mechanical) { s.counterweight.energy = 'MOVING'; s.exit.version++; s.exit.observedVersion = null;
      declare(s.impacts.exit, P.exitDelaySeconds); notes.push(`联锁松开后，原配重开始下落；${P.exitDelaySeconds}秒后会向同一机房门施加一次推力。须重新看清受力中的门，或普通制动。`); }
  };
  settleUntil(cursor);
  if (alive()) {
    const cost = doorEpilogueCost(s, c, h); e.cashCost = cost.cashCost; e.actions = cost.actions;
    e.spirituality = cost.spirituality; e.mind = cost.mind;
    switch (c.type) {
      case 'OBSERVE':
        advance(cost.seconds); s.observed = true; s.worker.consent = 'ACCEPT'; s.exit.observedVersion = s.exit.version;
        notes.push('艾达当面请求松开衣袖并带原工具车沿侧道出去。你看清八米维修位、原手刹、十二米处的机房门、维修位上的原开门连杆和二十四米普通侧道。只移开卡扣会先引起弹簧反弹，随后释放配重；原手刹可以实际卸掉两处力。'); break;
      case 'APPROACH_WORKER':
        advance(cost.seconds); if (alive()) { s.playerPosition = 8; s.playerMetres += 8; s.bodyVersion++; }
        notes.push('本人沿原八米工道走到艾达身旁，未移动她或原工具车。'); break;
      case 'RELEASE_CATCH':
        advance(cost.seconds); if (alive()) { s.latch.prepared = true; s.latch.condition -= 2; declare(s.impacts.spring, P.springDelaySeconds);
          notes.push(`原卡扣已拨到受力位；下一次明确冲击是${P.springDelaySeconds}秒后原弹簧对本人手臂的反弹。艾达仍被夹住，尚未结算伤害。`); } break;
      case 'CONCEPTUAL_ESCAPE': case 'SEAL_EXIT': {
        const escape = c.type === 'CONCEPTUAL_ESCAPE', w = escape ? s.escape : s.seal, prop = escape ? s.supplies.focus : s.supplies.seal;
        prop.stock = 0; prop.holder = 'SPENT'; prop.purchasedEventId = h.eventId; prop.spentEventId = h.eventId;
        w.attempted = true; w.passed = passed(h.check!); w.targetId = escape ? s.impacts.spring.id : s.exit.id;
        w.targetActorId = escape ? s.actorId : null; w.conditionVersion = escape ? s.bodyVersion : s.exit.version;
        advance(cost.seconds); w.openedEventId = h.eventId;
        if (w.passed && alive()) { w.openedSecond = cursor; w.expiresSecond = cursor + (escape ? P.escape.windowSeconds : P.seal.windowSeconds); }
        notes.push(`本人实付${cost.cashCost}便士、${cost.spirituality}灵性、${cost.mind}精神和1行动，唯一${escape ? '聚焦插片' : '封锁衬条'}已经用掉。${w.passed ? escape ? '仅对本人下一次已指定弹簧冲击开出3秒窗口，尚未实际避开冲击。' : '仅封住当前亲见的同一机房门20秒，侧道照常通行；尚未抵住实际推力。' : '本次施术没有稳定下来，费用不退，也不能重试；原危险仍按实际时刻发生。'}`); break;
      }
      case 'FREE_WORKER': advance(cost.seconds); if (alive()) freeWorker(false); break;
      case 'OBSERVE_EXIT': advance(cost.seconds); if (alive()) { s.exit.observedVersion = s.exit.version; notes.push('重新看清同一机房门、原门框及当前受力状态；没有把旧观察当成新条件。'); } break;
      case 'OPEN_EXIT':
        advance(cost.seconds); if (alive()) { s.exit.closed = false; s.exit.version++; s.exit.observedVersion = null; end(s.seal, 'EXIT_CHANGED');
          notes.push('从维修位拉动原连杆，实际打开四米外的同一机房门；原出口条件改变，临时封锁失效；已开始的配重推力仍会按时到来。'); } break;
      case 'STOP_EFFECTS': end(s.escape, 'STOPPED'); end(s.seal, 'STOPPED'); advance(cost.seconds);
        notes.push('本人停止临时效果；原弹簧与配重不会因此消失，已结算伤势也不改变。'); break;
      case 'WAIT_WINDOW': advance(cost.seconds); notes.push('实际等待25秒，期间到时的真实冲击已按各自时刻结算。'); break;
      case 'ISOLATE_AND_FREE': {
        if (s.playerPosition === 0) { advance(P.approachSeconds); if (alive()) { s.playerPosition = 8; s.playerMetres += 8; s.bodyVersion++; } }
        if (!alive()) break;
        // The brake becomes effective after one actual second. A hit due at or
        // before that instant is settled first and cannot be erased afterward.
        advance(1); if (!alive()) break;
        s.brake.applied = true; s.brake.condition -= P.brakeWear; s.isolated = true;
        for (const i of [s.impacts.spring, s.impacts.exit]) if (i.status === 'PENDING') { i.status = 'MECHANICALLY_STOPPED';
          i.resolvedEventId = h.eventId; i.resolvedSecond = cursor; }
        s.latch.spring = 'DISCHARGED'; if (s.counterweight.energy !== 'SPENT') s.counterweight.energy = 'SECURED';
        end(s.escape, 'ISOLATED'); end(s.seal, 'ISOLATED');
        advance(P.isolateSeconds - 1); if (alive() && s.worker.trapped) freeWorker(true);
        notes.push('用同一原手刹卡住配重并卸掉弹簧余力，再完成普通解困。手刹磨损6，真实用去60秒；没有新行动或现款成本，既有伤势、门损与工具车损耗都保留。'); break;
      }
      case 'GUIDE_SIDE_EXIT':
        advance(P.loadSeconds); if (!alive() || s.worker.status !== 'ACTIVE') break;
        leaveBay(); s.worker.position = 'SIDE_PASSAGE'; s.trolley.position = 'SIDE_PASSAGE'; s.trolley.holderId = s.actorId;
        advance(P.sideSeconds); s.playerPosition = 0; s.playerMetres += P.sideMetres;
        s.worker.position = 0; s.worker.travelledMetres += P.sideMetres; s.trolley.position = 0; s.trolley.travelledMetres += P.sideMetres; s.trolley.holderId = s.worker.id;
        s.arrival = { eventId: h.eventId, second: cursor, routeId: S.ordinaryExitId, workerId: s.worker.id, trolleyId: s.trolley.id, metres: P.sideMetres };
        s.status = 'RESOLVED'; end(s.escape, 'MOVED'); end(s.seal, 'STOPPED');
        notes.push('本人先花8秒扶稳艾达并装好同一工具车，再与她和原车实走24米侧道、用去24秒到棚外。原车仍归艾达，伤势和磨损没有恢复。'); break;
      case 'WITHDRAW':
        if (s.playerPosition !== 0) { advance(1); if (!alive()) break; leaveBay(); advance(P.sideSeconds - 1); s.playerPosition = 0; s.playerMetres += P.sideMetres; }
        else advance(1);
        s.status = 'WITHDRAWN'; end(s.escape, 'MOVED'); end(s.seal, 'STOPPED');
        notes.push(`本人实际沿普通侧道退出；艾达${s.worker.position === 0 ? '已经在棚外' : s.worker.trapped ? '仍在八米维修位被夹住' : '仍在八米维修位'}，原工具车也留在其真实位置，不能报作已经救出。`); break;
      case 'REPORT': advance(cost.seconds); s.reported = true;
        notes.push(`如实交接：艾达${s.worker.position === 0 ? '已在棚外' : s.worker.trapped ? '仍在八米维修位被夹住' : '仍在八米维修位'}，健康${s.worker.health}，原挫伤仍在；原工具车${s.trolley.position === 0 ? '已交还棚外的艾达' : '仍留在维修位'}，状况${s.trolley.condition}。原机房门状况${s.exit.condition}，手刹状况${s.brake.condition}。仅实际处理过指定冲击的技巧增加掌握。`); break;
    }
  }
  if (!alive()) { s.status = 'WITHDRAWN'; end(s.escape, 'STOPPED'); end(s.seal, 'STOPPED');
    notes.push('本人实际生命耗尽，停止后续动作；艾达和原件保留在最后真实位置，死亡不能算作成功撤离。'); }
  e.seconds = cursor - h.nowSecond; s.lastSecond = cursor;
  s.journal.push({ eventId: h.eventId, revision: h.revision, command: clone(c), host: clone(h), beforeSecond: h.nowSecond,
    afterSecond: cursor, effect: clone(e), check: clone(h.check), masteryGains: { ...masteryGains }, notes: [...notes] });
  return { state: s, effect: e, notes, injuries, masteryGains };
}
/** Exact structural replay. Source admission and the actual S0 promotion are
 * separately authenticated by the owning chapter, never by this projection. */
export function validateDoorEpilogueState(value: unknown): value is DoorEpilogueState {
  try {
    const s = value as DoorEpilogueState; if (!s || typeof s !== 'object' || !Array.isArray(s.journal)) return false;
    let replay = createDoorEpilogue({ actorId: s.actorId, week: s.startedWeek, nowSecond: s.startedSecond });
    for (const j of s.journal) replay = applyDoorEpilogue(replay, j.command, j.host).state;
    return stableStringify(replay) === stableStringify(s);
  } catch { return false; }
}
export function projectDoorEpilogue(s: DoorEpilogueState) {
  const person = s.worker.position === 0 ? '棚外' : s.worker.position === 'SIDE_PASSAGE' ? '普通侧道中' : '八米维修位';
  return { story: s.journal.at(-1)?.notes.join(' ') ?? S.story,
    nextStep: s.reported ? '本次真实结果已交接；挫伤和原件损耗仍需日常照料。' : s.status !== 'ACTIVE' ? '如实交接实际人员位置、伤势和原件损耗。' :
      !s.observed ? '先查看艾达、工具车、原手刹和普通侧道。' : s.worker.trapped ? '可用原手刹普通卸力解困，或到身旁处理卡扣。' : '可普通制动后带艾达与原车走侧道；机房门也可尝试一次短封锁。',
    lines: [
      `${s.worker.name}（${s.worker.age}岁）在${person}，${s.worker.trapped ? '仍被原卡扣夹住' : '已实际解困'}，健康${s.worker.health}；${s.worker.injuries.join('；')}。`,
      `同一工具车${s.trolley.position === 0 ? '已到棚外' : '仍在棚内'}，状况${s.trolley.condition}，仍属艾达；只保留这一辆原车。`,
      `机房门${s.exit.closed ? '关闭' : '打开'}，状况${s.exit.condition}；原手刹状况${s.brake.condition}，${s.isolated ? '已真实制动卸力' : '尚未普通制动'}。二十四米侧道始终是独立退路。`,
      `本人避开冲击：${s.escape.applied ? '确实避开下一次指定反弹，掌握增8' : s.escape.attempted ? '已尝试，尚无实际避开记录' : '尚未尝试'}；短封出口：${s.seal.applied ? '确实抵住同门的一次推力，掌握增8' : s.seal.attempted ? '已尝试，尚无实际抵挡记录' : '尚未尝试'}。`,
      '避开冲击需8便士、14灵性、8精神、1行动，仅限本人、指定下一击和3秒；短封出口需6便士、12灵性、6精神、1行动，仅限当前亲见的一扇门和20秒。各只尝试一次，失败费用照付。',
      '拨动卡扣后4秒发生弹簧反弹；解困后10秒配重推撞机房门。施术本身不取消伤势；移动本人、打开同门、停止效果或超时会限制效果。真正发生并被处理的冲击才增加掌握。',
      '普通手刹卸力与解困需60秒，原手刹磨损6；扶稳装车8秒，再实走24米侧道24秒。不需行动或现款；本人独退不会移动艾达或原车。',
    ] };
}
export function getDoorEpilogueActions(s: DoorEpilogueState, h: DoorHost) {
  const labels: Record<DoorEpilogueCommand['type'], string> = {
    OBSERVE: '查看工人、原件与普通退路', APPROACH_WORKER: '沿八米工道走到艾达身旁', RELEASE_CATCH: '拨动原卡扣并看清即将反弹的弹簧',
    CONCEPTUAL_ESCAPE: '仅对本人下一次反弹尝试短暂避开', FREE_WORKER: '实际松开艾达与原工具车', OBSERVE_EXIT: '看清当前受力的同一机房门',
    SEAL_EXIT: '对同一机房门尝试二十秒短封锁', OPEN_EXIT: '拉动原连杆开门，解除临时封锁', STOP_EFFECTS: '停止临时效果',
    WAIT_WINDOW: '实际等候二十五秒', ISOLATE_AND_FREE: '用原手刹普通卸力并解困', GUIDE_SIDE_EXIT: '带艾达与原工具车实走侧道',
    WITHDRAW: '本人独自沿普通侧道退出', REPORT: '如实交接当前人员与损耗',
  };
  const actions = TYPES.map(type => { const command: DoorEpilogueCommand = { type }, e = doorEpilogueCost(s, command, h), reason = doorEpilogueBlock(s, command, h);
    return { command, label: labels[type], cost: `${e.actions}行动、${e.cashCost}便士、${e.spirituality}灵性、${e.mind}精神，实际${e.seconds}秒${isCast(command) ? '；只尝试一次，费用照付，未处理真实冲击不增掌握' : type === 'OPEN_EXIT' ? '；会使短封锁失效，原推力仍会到来' : ''}`,
      enabled: reason === null, reason, preferredAction: false }; });
  const available = (type: DoorEpilogueCommand['type']) => actions.some(a => a.command.type === type && a.enabled);
  const afford = (p: typeof P.escape | typeof P.seal) => h.actions >= p.actions && h.cash >= p.cashCost &&
    h.spirituality >= p.spirituality && h.mind > p.mind;
  let desired: DoorEpilogueCommand['type'];
  if (s.status !== 'ACTIVE') desired = 'REPORT';
  else if (!s.observed) desired = 'OBSERVE';
  else if (s.worker.trapped) {
    if (s.escape.attempted && !s.escape.passed) desired = 'ISOLATE_AND_FREE';
    else if (!s.latch.prepared) desired = !afford(P.escape) ? 'ISOLATE_AND_FREE' : s.playerPosition === 0 ? 'APPROACH_WORKER' : 'RELEASE_CATCH';
    else if (!s.escape.attempted) desired = available('CONCEPTUAL_ESCAPE') ? 'CONCEPTUAL_ESCAPE' : 'ISOLATE_AND_FREE';
    else desired = s.escape.applied || (s.impacts.spring.dueSecond !== null && live(s.escape, s.impacts.spring.dueSecond)) ? 'FREE_WORKER' : 'ISOLATE_AND_FREE';
  } else if (!s.isolated && s.impacts.exit.status === 'PENDING') {
    if (s.seal.attempted) desired = s.impacts.exit.dueSecond !== null && live(s.seal, s.impacts.exit.dueSecond) &&
      s.seal.conditionVersion === s.exit.version && s.exit.closed ? 'GUIDE_SIDE_EXIT' : 'ISOLATE_AND_FREE';
    else if (!afford(P.seal) || !s.exit.closed || s.impacts.exit.dueSecond === null ||
      h.nowSecond + P.seal.seconds + (s.exit.observedVersion === s.exit.version ? 0 : P.observeExitSeconds) >= s.impacts.exit.dueSecond)
      desired = 'ISOLATE_AND_FREE';
    else desired = s.exit.observedVersion !== s.exit.version ? 'OBSERVE_EXIT' : available('SEAL_EXIT') ? 'SEAL_EXIT' : 'ISOLATE_AND_FREE';
  } else desired = 'GUIDE_SIDE_EXIT';
  const next = actions.find(a => a.command.type === desired && a.enabled) ??
    actions.find(a => a.command.type === 'ISOLATE_AND_FREE' && a.enabled) ?? actions.find(a => a.command.type === 'WITHDRAW' && a.enabled);
  if (next) next.preferredAction = true;
  return actions;
}
