import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { ErrorAscentEpilogueEffect, ErrorAscentEpilogueHost } from './epilogue-ports.js';
import { ERROR_ASCENT_EPILOGUE_POLICY as P, ERROR_ASCENT_EPILOGUE_SCENE as S } from './epilogue-content.js';
export type { ErrorAscentEpilogueEffect, ErrorAscentEpilogueHost } from './epilogue-ports.js';
export const ERROR_ASCENT_EPILOGUE_ABILITY_IDS = ['error.s0.short-motion-theft', 'error.s0.linked-release-error'] as const;
const [THEFT, DIVERSION] = ERROR_ASCENT_EPILOGUE_ABILITY_IDS;
const TYPES = ['OBSERVE', 'STEAL_MOVEMENT', 'APPROACH_LEVER', 'PULL_RELEASE', 'DIVERT_RELEASE',
  'CROSS_EXIT', 'STOP_EFFECTS', 'WAIT_WINDOW', 'WITHDRAW', 'REPORT'] as const;
export type ErrorAscentEpilogueCommand = { type: typeof TYPES[number] };
export interface ErrorAscentSceneInjury {
  id: string; severity: 'LIGHT'; acquiredRevision: number; treatedRevision: number | null;
}
interface ErrorAscentApplication {
  attempted: boolean; passed: boolean; applied: boolean;
  castEventId: string | null; castSecond: number | null;
  appliedEventId: string | null; appliedSecond: number | null;
}
interface ErrorAscentLatch {
  id: string; quantity: 1; positionMetres: number; mechanismId: string;
  type: 'STEEL_RELEASE_CATCH'; latched: boolean; condition: number;
  releasedSecond: number | null;
}
export interface ErrorAscentEpilogueState {
  id: typeof S.id; actorId: string; location: typeof S.location;
  startedWeek: number; startedSecond: number; lastSecond: number;
  status: 'ACTIVE' | 'ESCAPED' | 'WITHDRAWN' | 'DEAD'; observed: boolean; reported: boolean;
  player: { route: 'GALLERY' | 'SIDE_STAIRS' | 'OUTSIDE_MAIN' | 'OUTSIDE_SIDE';
    positionMetres: number; travelledMetres: number; sideEntryFromMetres: number | null;
    healthLoss: number; injuries: ErrorAscentSceneInjury[] };
  guard: { id: string; name: string; age: number; health: number; positionMetres: number;
    travelledMetres: number; status: 'ADVANCING' | 'CUTTING_LINK' | 'PURSUING' | 'STOPPED_BY_GRILLE' | 'STOPPED_BY_EXIT' | 'SEARCHING_OUTSIDE';
    knife: { id: string; quantity: 1; condition: number }; baton: { id: string; quantity: 1; condition: number };
    movement: { id: string; originalStartSecond: number; startSecond: number; dueSecond: number;
      state: 'PENDING' | 'MOVING' | 'COMPLETED'; completedSecond: number | null };
    cut: { state: 'PENDING' | 'CUT'; reachedSecond: number | null; dueSecond: number | null; cutSecond: number | null };
    strike: { used: boolean; second: number | null; healthLoss: number } };
  mechanism: {
    exit: { id: string; positionMetres: 8; open: boolean; condition: number; spring: 'HELD' | 'SPENT' };
    grille: { id: string; positionMetres: 2; open: boolean; condition: number; gravity: 'HELD' | 'SPENT' };
    exitLatch: ErrorAscentLatch; grilleLatch: ErrorAscentLatch;
    link: { id: string; endpoints: [string, string]; intact: boolean; condition: number; version: number };
    lever: { id: string; positionMetres: 4; strokesRemaining: 0 | 1; usedSecond: number | null };
    release: { id: string; state: 'UNDECLARED' | 'PENDING' | 'DIVERTED' | 'EXIT_CLOSED';
      declaredEventId: string | null; declaredSecond: number | null; dueSecond: number | null;
      settledEventId: string | null; settledSecond: number | null; actualLatchId: string | null };
  };
  theft: ErrorAscentApplication & { movementId: string | null; targetActorId: string | null;
    remainingSeconds: number; stolenSeconds: number; playerMetresDuringDelay: number; firstUsedSecond: number | null; stopped: boolean };
  diversion: ErrorAscentApplication & { releaseId: string | null; linkId: string | null;
    fromLatchId: string | null; toLatchId: string | null; linkVersion: number | null;
    expiresSecond: number | null; endedReason: 'USED' | 'STOPPED' | 'EXPIRED' | 'LINK_CUT' | 'LEFT_POSITION' | null };
  arrival: { eventId: string; second: number; routeId: string; travelledMetres: number; pursuerStopped: boolean } | null;
  journal: { eventId: string; revision: number; command: ErrorAscentEpilogueCommand;
    host: ErrorAscentEpilogueHost; beforeSecond: number; afterSecond: number;
    effect: ErrorAscentEpilogueEffect; masteryGains: Record<string, number>; notes: string[] }[];
}
const clone = <T>(value: T): T => structuredClone(value);
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const application = (): ErrorAscentApplication => ({ attempted: false, passed: false, applied: false,
  castEventId: null, castSecond: null, appliedEventId: null, appliedSecond: null });
const empty = (): ErrorAscentEpilogueEffect => ({ cashCost: 0, cashGain: 0, actions: 0,
  spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
const cast = (c: ErrorAscentEpilogueCommand) => c.type === 'STEAL_MOVEMENT' || c.type === 'DIVERT_RELEASE';
const passed = (c: PublicCheckResult) => c.tier === 'SUCCESS' || c.tier === 'GREAT_SUCCESS';
const liveDiversion = (s: ErrorAscentEpilogueState, second: number) => s.diversion.passed && !s.diversion.applied &&
  s.diversion.endedReason === null && s.diversion.expiresSecond !== null && second <= s.diversion.expiresSecond;
function endDiversion(s: ErrorAscentEpilogueState, reason: NonNullable<ErrorAscentEpilogueState['diversion']['endedReason']>) {
  if (s.diversion.passed && !s.diversion.applied && s.diversion.endedReason === null) s.diversion.endedReason = reason;
}
export function validateErrorAscentEpilogueCommand(value: unknown): value is ErrorAscentEpilogueCommand {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 &&
    Object.hasOwn(value, 'type') && TYPES.includes((value as ErrorAscentEpilogueCommand).type);
}
/** Creation supplies only this independent original guard and apparatus. It
 * never imports/revives an old opponent, grants inventory, or proves promotion. */
export function createErrorAscentEpilogue(input: { actorId: string; week: number; nowSecond: number }): ErrorAscentEpilogueState {
  if (typeof input.actorId !== 'string' || !input.actorId.trim() || !integer(input.week, 1) || !integer(input.nowSecond))
    throw Error('须提供同一本人的真实身份、周次和时间。');
  const start = input.nowSecond + P.guardPreparationSeconds;
  const latch = (id: string, positionMetres: number, mechanismId: string): ErrorAscentLatch => ({ id, quantity: 1,
    positionMetres, mechanismId, type: 'STEEL_RELEASE_CATCH', latched: true, condition: 86, releasedSecond: null });
  return {
    id: S.id, actorId: input.actorId, location: S.location, startedWeek: input.week,
    startedSecond: input.nowSecond, lastSecond: input.nowSecond, status: 'ACTIVE', observed: false, reported: false,
    player: { route: 'GALLERY', positionMetres: 0, travelledMetres: 0, sideEntryFromMetres: null, healthLoss: 0, injuries: [] },
    guard: { id: S.guardId, name: S.guardName, age: S.guardAge, health: S.guardHealth,
      positionMetres: S.guardStartMetres, travelledMetres: 0, status: 'ADVANCING',
      knife: { id: S.knifeId, quantity: 1, condition: 84 }, baton: { id: S.batonId, quantity: 1, condition: 88 },
      movement: { id: S.movementId, originalStartSecond: start, startSecond: start,
        dueSecond: start + P.guardAdvanceSeconds, state: 'PENDING', completedSecond: null },
      cut: { state: 'PENDING', reachedSecond: null, dueSecond: null, cutSecond: null },
      strike: { used: false, second: null, healthLoss: 0 } },
    mechanism: {
      exit: { id: S.exitId, positionMetres: 8, open: true, condition: 89, spring: 'HELD' },
      grille: { id: S.grilleId, positionMetres: 2, open: true, condition: 87, gravity: 'HELD' },
      exitLatch: latch(S.exitLatchId, S.exitMetres, S.exitId), grilleLatch: latch(S.grilleLatchId, S.grilleMetres, S.grilleId),
      link: { id: S.linkId, endpoints: [S.exitLatchId, S.grilleLatchId], intact: true, condition: 82, version: 1 },
      lever: { id: S.leverId, positionMetres: 4, strokesRemaining: 1, usedSecond: null },
      release: { id: S.releaseId, state: 'UNDECLARED', declaredEventId: null, declaredSecond: null,
        dueSecond: null, settledEventId: null, settledSecond: null, actualLatchId: null },
    },
    theft: { ...application(), movementId: null, targetActorId: null, remainingSeconds: 0, stolenSeconds: 0, playerMetresDuringDelay: 0, firstUsedSecond: null, stopped: false },
    diversion: { ...application(), releaseId: null, linkId: null, fromLatchId: null, toLatchId: null,
      linkVersion: null, expiresSecond: null, endedReason: null }, arrival: null, journal: [],
  };
}
/** At will27/perception29 after the original +1 promotion: 74% / 62%.
 * These are ordinary live-stat checks, never fixed success or local RNG. */
export function getErrorAscentEpilogueCheckInput(c: ErrorAscentEpilogueCommand): {
  ability: PublicCoreStatKey; difficulty: number; modifier: number; source: string;
} | null {
  const p = c.type === 'STEAL_MOVEMENT' ? P.theft : c.type === 'DIVERT_RELEASE' ? P.diversion : null;
  return p ? { ability: p.ability, difficulty: p.difficulty, modifier: p.modifier, source: p.source } : null;
}
function verifyCheck(c: ErrorAscentEpilogueCommand, h: ErrorAscentEpilogueHost) {
  const spec = getErrorAscentEpilogueCheckInput(c);
  if (!spec) { if (h.check !== null) throw Error('普通动作不能携带施术判定。'); return; }
  if (!h.check) throw Error('施术必须使用中央实际普通判定。');
  const ability = spec.ability as 'will' | 'perception';
  const actual = resolveNormalCheck({ ability, baseAbility: h.coreStats[ability], difficulty: spec.difficulty,
    modifiers: [{ source: spec.source, value: spec.modifier }], roll: h.check.roll });
  if (stableStringify(actual) !== stableStringify(h.check)) throw Error('中央判定不符合当前本人属性与本次有限目标。');
}
export function errorAscentEpilogueCost(s: ErrorAscentEpilogueState, c: ErrorAscentEpilogueCommand,
  _h?: ErrorAscentEpilogueHost): ErrorAscentEpilogueEffect {
  const e = empty(), p = c.type === 'STEAL_MOVEMENT' ? P.theft : c.type === 'DIVERT_RELEASE' ? P.diversion : null;
  if (p) return { ...e, actions: p.actions, cashCost: p.cashCost, spirituality: p.spirituality, mind: p.mind, seconds: p.seconds };
  const seconds: Record<ErrorAscentEpilogueCommand['type'], number> = {
    OBSERVE: P.observeSeconds, STEAL_MOVEMENT: P.theft.seconds,
    APPROACH_LEVER: Math.abs(S.leverMetres - s.player.positionMetres), PULL_RELEASE: P.leverSeconds,
    DIVERT_RELEASE: P.diversion.seconds, CROSS_EXIT: Math.max(0, S.outsideMetres - s.player.positionMetres),
    STOP_EFFECTS: P.stopSeconds, WAIT_WINDOW: P.waitSeconds,
    WITHDRAW: P.sideEntrySeconds + P.sideStairMetres, REPORT: P.reportSeconds,
  };
  e.seconds = seconds[c.type]; return e;
}
export function errorAscentEpilogueBlock(s: ErrorAscentEpilogueState, c: ErrorAscentEpilogueCommand,
  h: ErrorAscentEpilogueHost): string | null {
  if (!validateErrorAscentEpilogueCommand(c)) return '只能提交一个处置意图，不能自报结果、守卫、物件或骰值。';
  if (h.actorId !== s.actorId || h.sequence !== 0 || h.status !== 'ACTIVE' || h.health <= 0 || h.mind <= 0 || h.location !== s.location)
    return '须同一仍存活的错误序列0本人实际位于钟塔出口现场。';
  if (![h.nowSecond, h.cash, h.actions, h.health, h.mind, h.spirituality].every(n => integer(n)) ||
    !h.coreStats || ![h.coreStats.will, h.coreStats.perception].every(n => integer(n) && n <= 500) ||
    !integer(h.week, s.startedWeek) || !integer(h.revision, 1) || h.nowSecond !== s.lastSecond ||
    typeof h.eventId !== 'string' || !h.eventId.trim() || h.revision <= (s.journal.at(-1)?.revision ?? -1) ||
    s.journal.some(j => j.eventId === h.eventId)) return '真实时钟、资源、属性或动作次序不一致；不能跳过现场时间。';
  if (s.status === 'DEAD') return '本人已经在本次现场死亡，不能事后移动或交接。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先实际走出现场，再交接结果。' :
    s.reported ? '本次真实结果已经交接。' : null;
  if (s.status !== 'ACTIVE') return '本次撤离已结束，原人、原门、损耗与费用保持实际结果。';
  if (c.type === 'WITHDRAW' || c.type === 'STOP_EFFECTS' || c.type === 'WAIT_WINDOW') return null;
  if (c.type === 'OBSERVE') return s.observed ? '当前守卫、两个原锁扣、原联索与侧阶已经看清。' : null;
  if (!s.observed) return '先看清眼前守卫、实际机构与普通侧阶。';
  if (s.player.route !== 'GALLERY') return '须本人仍在可见的外廊上。';
  if (c.type === 'APPROACH_LEVER') return s.player.positionMetres >= S.leverMetres ? '本人已到或经过原扳杆。' : null;
  if (c.type === 'CROSS_EXIT') return s.player.positionMetres < S.leverMetres ? '先实走到四米处扳杆旁。' :
    !s.mechanism.exit.open ? '同一外门已真实落闭；普通侧阶仍然可走。' : null;
  if (c.type === 'PULL_RELEASE') return s.player.positionMetres !== S.leverMetres ? '须实际站在四米处原扳杆旁。' :
    s.mechanism.lever.strokesRemaining !== 1 ? '原延时器仅有这一次已蓄好的行程，不能重置。' : null;
  if (c.type === 'STEAL_MOVEMENT' && (s.theft.attempted || s.guard.movement.state !== 'PENDING' ||
    h.nowSecond + P.theft.seconds >= s.guard.movement.originalStartSecond ||
    Math.abs(s.player.positionMetres - s.guard.positionMetres) > 12))
    return '只能对当前看见、尚未开始的同一守卫移动尝试一次；已经走过的距离和时间不能倒改。';
  if (c.type === 'DIVERT_RELEASE' && (s.diversion.attempted || s.player.positionMetres !== S.leverMetres ||
    s.mechanism.release.state !== 'PENDING' || s.mechanism.release.dueSecond === null ||
    h.nowSecond + P.diversion.seconds >= s.mechanism.release.dueSecond || !s.mechanism.link.intact ||
    !s.mechanism.exitLatch.latched || !s.mechanism.grilleLatch.latched ||
    s.mechanism.link.endpoints[0] !== s.mechanism.exitLatch.id || s.mechanism.link.endpoints[1] !== s.mechanism.grilleLatch.id))
    return '须在原扳杆旁，原联索仍连接两个同型原锁扣，且同一次释放尚未发生；只能尝试一次。';
  const e = errorAscentEpilogueCost(s, c, h);
  return h.actions < e.actions ? '行动不足；普通侧阶不耗行动。' : h.cash < e.cashCost ? '现款不足；普通侧阶不收费。' :
    h.spirituality < e.spirituality || h.mind <= e.mind ? '实际灵性或精神不足；仍可直接走侧阶离开。' : null;
}

/** Each command advances the same second clock, including the independent
 * guard's finite movement, physical cut and one ordinary strike. No local RNG. */
export function applyErrorAscentEpilogue(previous: ErrorAscentEpilogueState, c: ErrorAscentEpilogueCommand,
  h: ErrorAscentEpilogueHost): { state: ErrorAscentEpilogueState; effect: ErrorAscentEpilogueEffect;
    notes: string[]; injuries: ErrorAscentSceneInjury[]; masteryGains: Record<string, number> } {
  const reason = errorAscentEpilogueBlock(previous, c, h); if (reason) throw Error(reason); verifyCheck(c, h);
  const s = clone(previous), e = errorAscentEpilogueCost(s, c, h), notes: string[] = [];
  const injuries: ErrorAscentSceneInjury[] = [], masteryGains: Record<string, number> = {};
  const intendedSeconds = e.seconds; e.seconds = 0;
  let cursor = h.nowSecond;
  const alive = () => h.health > e.health && h.mind > e.mind;
  const use = (a: ErrorAscentApplication, id: string) => {
    if (a.applied) return;
    a.applied = true; a.appliedEventId = h.eventId; a.appliedSecond = cursor; masteryGains[id] = 8;
  };
  const guardStep = (to: number) => { s.guard.travelledMetres += Math.abs(to - s.guard.positionMetres); s.guard.positionMetres = to; };
  const hurt = () => {
    const amount = P.guardStrikeHealthLoss, injury: ErrorAscentSceneInjury = {
      id: `${h.eventId}:error-exit-guard-strike`, severity: 'LIGHT', acquiredRevision: h.revision, treatedRevision: null };
    e.health += amount; s.player.healthLoss += amount; s.player.injuries.push(injury); injuries.push(injury);
    s.guard.strike = { used: true, second: cursor, healthLoss: amount }; s.guard.baton.condition -= 2;
    notes.push(`第${cursor}秒，追到身旁的马雷克用同一根短棍实际击中本人，健康损失${amount}并留下轻伤；旧伤不变。`);
  };
  const tick = (playerMovedMetres: number) => {
    const g = s.guard, m = s.mechanism, movement = g.movement;
    if (movement.state !== 'COMPLETED' && cursor > movement.startSecond) {
      if (movement.state === 'PENDING' && s.theft.passed && !s.theft.stopped && s.theft.remainingSeconds > 0 &&
        s.theft.movementId === movement.id && s.theft.targetActorId === g.id) {
        // Remove only this actual upcoming second; no elapsed second is refunded.
        s.theft.remainingSeconds--; s.theft.stolenSeconds++; movement.startSecond++; movement.dueSecond++;
        if (s.player.route === 'GALLERY' && playerMovedMetres > 0) {
          s.theft.playerMetresDuringDelay += playerMovedMetres; s.theft.firstUsedSecond ??= cursor;
        }
      } else {
        movement.state = 'MOVING'; guardStep(Math.min(0, g.positionMetres + 2));
        if (s.theft.stolenSeconds > 0 && s.theft.playerMetresDuringDelay > 0 && !s.theft.applied) {
          use(s.theft, THEFT);
          notes.push(`第${cursor}秒，同一守卫终于实际迈出原移动的第一段；此前确实失去${s.theft.stolenSeconds}秒，本人已利用其中的时间实走${s.theft.playerMetresDuringDelay}米，短时窃取这时才计掌握8。没有倒改已执行移动或返还行动。`);
        }
        if (cursor >= movement.dueSecond) {
          movement.state = 'COMPLETED'; movement.completedSecond = cursor; g.status = 'CUTTING_LINK';
          g.cut.reachedSecond = cursor + 1; g.cut.dueSecond = cursor + 1 + P.guardCutSeconds;
          notes.push(`守卫实走八米抵达外廊零米位，开始走向一米处联索并用自己的原小刀切线。`);
        }
      }
    }
    if (g.cut.state === 'PENDING' && g.cut.reachedSecond !== null && cursor >= g.cut.reachedSecond) guardStep(S.cableCutMetres);
    // A cut completed at the same instant wins; an already completed diversion
    // is never undone. Cutting does not remove the original exit escapement.
    if (g.cut.state === 'PENDING' && g.cut.dueSecond !== null && cursor >= g.cut.dueSecond) {
      g.cut.state = 'CUT'; g.cut.cutSecond = cursor; g.knife.condition -= 3;
      m.link.intact = false; m.link.condition = 0; m.link.version++; endDiversion(s, 'LINK_CUT');
      g.status = m.grille.open ? 'PURSUING' : 'STOPPED_BY_GRILLE';
      notes.push(`第${cursor}秒，马雷克实际切断原联索，原小刀磨损3；尚未应用的借联索转移失效，已经释放的原机构不会复原。`);
    }
    if (m.release.state === 'PENDING' && m.release.dueSecond !== null && cursor >= m.release.dueSecond) {
      const w = s.diversion;
      const diverted = liveDiversion(s, cursor) && w.releaseId === m.release.id && w.linkId === m.link.id &&
        w.linkVersion === m.link.version && m.link.intact && w.fromLatchId === m.exitLatch.id &&
        w.toLatchId === m.grilleLatch.id && m.link.endpoints[0] === m.exitLatch.id && m.link.endpoints[1] === m.grilleLatch.id &&
        m.exitLatch.type === m.grilleLatch.type && m.exitLatch.latched && m.grilleLatch.latched &&
        s.player.route === 'GALLERY' && s.player.positionMetres >= S.leverMetres && s.player.positionMetres < S.outsideMetres;
      m.release.settledEventId = h.eventId; m.release.settledSecond = cursor;
      const latch = diverted ? m.grilleLatch : m.exitLatch;
      latch.latched = false; latch.condition -= P.latchWear; latch.releasedSecond = cursor; m.release.actualLatchId = latch.id;
      if (diverted) {
        m.release.state = 'DIVERTED'; m.grille.open = false; m.grille.gravity = 'SPENT'; m.grille.condition -= P.grilleWear;
        use(w, DIVERSION); w.endedReason = 'USED';
        if (g.positionMetres < S.grilleMetres) g.status = 'STOPPED_BY_GRILLE';
        notes.push(`第${cursor}秒，原延时器那唯一一次释放经仍真实连接的原联索落到内栅栏锁扣。原栅栏用自身重力落下并磨损3，同一外门仍开着、原弹簧仍受扣；没有复制力或物件。此次实际应用才计掌握8。`);
      } else {
        m.release.state = 'EXIT_CLOSED'; m.exit.open = false; m.exit.spring = 'SPENT'; m.exit.condition -= P.exitWear;
        notes.push(`第${cursor}秒，同一次原释放仍落到外门锁扣，原弹簧使同一外门落闭并磨损3；侧阶不受影响，事后不能改写本次释放。`);
      }
    }
    if (g.cut.state === 'CUT' && cursor > g.cut.cutSecond!) {
      if (!m.grille.open && g.positionMetres < S.grilleMetres) g.status = 'STOPPED_BY_GRILLE';
      else if (g.positionMetres < S.outsideMetres) {
        const next = Math.min(S.outsideMetres, g.positionMetres + 1);
        if (!m.exit.open && next >= S.exitMetres) g.status = 'STOPPED_BY_EXIT';
        else { g.status = 'PURSUING'; guardStep(next); }
        if (!g.strike.used && s.player.route === 'GALLERY' && Math.abs(g.positionMetres - s.player.positionMetres) <= 1 && alive()) hurt();
        if (g.positionMetres === S.outsideMetres) g.status = 'SEARCHING_OUTSIDE';
      }
    }
    if (s.diversion.expiresSecond !== null && cursor > s.diversion.expiresSecond) endDiversion(s, 'EXPIRED');
  };
  const advance = (seconds: number, move?: () => void) => {
    for (let n = 0; n < seconds && alive(); n++) {
      const walkedBefore = s.player.travelledMetres; cursor++; move?.(); tick(s.player.travelledMetres - walkedBefore);
    }
  };
  const playerStep = (to: number) => { s.player.travelledMetres += Math.abs(to - s.player.positionMetres); s.player.positionMetres = to; };
  const arrive = (route: 'OUTSIDE_MAIN' | 'OUTSIDE_SIDE') => {
    s.player.route = route; s.status = route === 'OUTSIDE_MAIN' ? 'ESCAPED' : 'WITHDRAWN';
    s.theft.remainingSeconds = 0; s.theft.stopped = true; endDiversion(s, 'LEFT_POSITION');
    s.arrival = { eventId: h.eventId, second: cursor, routeId: route === 'OUTSIDE_MAIN' ? S.mainExitId : S.sideExitId,
      travelledMetres: s.player.travelledMetres, pursuerStopped: s.guard.status === 'STOPPED_BY_GRILLE' };
  };
  switch (c.type) {
    case 'OBSERVE':
      advance(intendedSeconds); if (alive()) s.observed = true;
      notes.push('看清这个独立的新守卫、四米处原扳杆、八米处同一出口，以及原联索两端的同型锁扣。扳杆只剩一次五秒延时释放；外门靠自己的弹簧、内栅栏靠自己的重力。旁边侧阶可直接实走离开。'); break;
    case 'STEAL_MOVEMENT': {
      s.theft.attempted = true; s.theft.castEventId = h.eventId;
      s.theft.movementId = s.guard.movement.id; s.theft.targetActorId = s.guard.id;
      advance(intendedSeconds); s.theft.castSecond = cursor; s.theft.passed = passed(h.check!) && alive();
      if (s.theft.passed) s.theft.remainingSeconds = P.theft.windowSeconds;
      notes.push(`实付1行动、14灵性、6精神和1秒；${s.theft.passed ? '仅准备从亲见守卫同一段尚未开始的移动中逐秒夺走最多3秒，尚未产生实际移动应用。' : '未能夺走那段待执行移动，费用照付，本次不重试。'} 原来已走过的时间、距离、伤势和周行动不变。`); break;
    }
    case 'APPROACH_LEVER':
      advance(intendedSeconds, () => playerStep(Math.min(S.leverMetres, s.player.positionMetres + 1)));
      if (alive()) notes.push('本人按每秒一米实走到原扳杆旁，没有瞬移或增加行动。'); break;
    case 'PULL_RELEASE':
      advance(intendedSeconds); if (alive()) {
        s.mechanism.lever.strokesRemaining = 0; s.mechanism.lever.usedSecond = cursor;
        Object.assign(s.mechanism.release, { state: 'PENDING', declaredEventId: h.eventId,
          declaredSecond: cursor, dueSecond: cursor + P.releaseDelaySeconds });
        notes.push(`原扳杆唯一行程已经耗用；同一个延时器将在第${cursor + P.releaseDelaySeconds}秒释放外门锁扣。只能在实际发生前，利用现存原联索尝试一次转移。`);
      } break;
    case 'DIVERT_RELEASE': {
      const w = s.diversion, m = s.mechanism;
      Object.assign(w, { attempted: true, castEventId: h.eventId, releaseId: m.release.id, linkId: m.link.id,
        fromLatchId: m.exitLatch.id, toLatchId: m.grilleLatch.id, linkVersion: m.link.version });
      advance(intendedSeconds); w.castSecond = cursor; w.passed = passed(h.check!) && alive();
      if (w.passed) { w.expiresSecond = cursor + P.diversion.windowSeconds; if (!m.link.intact) w.endedReason = 'LINK_CUT'; }
      notes.push(`实付1行动、12灵性、6精神和2秒；${w.passed ? '仅为同一次尚待发生的释放建立20秒转移窗口，必须保有原联索、两个原锁扣与实际近处位置。真正释放前不计掌握；守卫切线可使它失效。' : '未能建立有限转移，费用照付，本次不重试。'} 没有增添锁扣、力、钥匙或库存。`); break;
    }
    case 'CROSS_EXIT':
      advance(intendedSeconds, () => {
        const next = s.player.positionMetres + 1;
        if (next < S.exitMetres || s.mechanism.exit.open) playerStep(Math.min(S.outsideMetres, next));
      });
      if (alive() && s.player.positionMetres === S.outsideMetres) {
        arrive('OUTSIDE_MAIN'); notes.push(`本人沿原路实际走出同一外门，到九米处外平台；${s.arrival!.pursuerStopped ? '同一内栅栏已真实挡住马雷克，短暂脱离追击的目标完成。' : '马雷克没有被挡住，不能宣称追兵已停。'}`);
      } else if (alive()) notes.push('外门已经落闭，本人实际停在门内最后位置；没有穿门，仍可直接走侧阶撤离。'); break;
    case 'STOP_EFFECTS':
      s.theft.remainingSeconds = 0; s.theft.stopped = true; endDiversion(s, 'STOPPED'); advance(intendedSeconds);
      notes.push('停止剩余有限效果。守卫已实际失去的时间不退回，原扳杆已排定的释放、切线、伤势和费用不撤销。'); break;
    case 'WAIT_WINDOW': advance(intendedSeconds); notes.push('实际等候21秒；守卫、切线和原机构均按真实时间推进。'); break;
    case 'WITHDRAW':
      advance(P.sideEntrySeconds); if (!alive()) break;
      s.player.sideEntryFromMetres = s.player.positionMetres; s.player.travelledMetres++;
      s.player.route = 'SIDE_STAIRS'; s.player.positionMetres = 0;
      s.theft.remainingSeconds = 0; s.theft.stopped = true; endDiversion(s, 'LEFT_POSITION');
      advance(P.sideStairMetres, () => playerStep(s.player.positionMetres + 1));
      if (alive()) { arrive('OUTSIDE_SIDE'); notes.push('本人实走一步进入紧邻外廊的侧阶，再走完原二十四米阶道到街面。没有行动或现金成本；守卫和两个原机构留在实际位置，既有失败费用与伤势保留。'); } break;
    case 'REPORT':
      advance(intendedSeconds); if (alive()) s.reported = true;
      notes.push(`如实交接：本人${s.player.route === 'OUTSIDE_MAIN' ? '已在原主门外平台' : '已在侧阶外街面'}，累计实走${s.player.travelledMetres}米，本场健康损失${s.player.healthLoss}；守卫在${s.guard.positionMetres}米处、健康${s.guard.health}。外门${s.mechanism.exit.open ? '仍开' : '已闭'}、内栅栏${s.mechanism.grille.open ? '仍开' : '已落'}，原联索${s.mechanism.link.intact ? '仍连着' : '已被切断'}，没有补回物件或既有伤势。`); break;
  }
  if (!alive()) {
    s.status = 'DEAD'; s.theft.remainingSeconds = 0; s.theft.stopped = true; endDiversion(s, 'STOPPED');
    notes.push('本人实际生命耗尽，后续移动立即停止；原位置、伤势与物件保留，死亡不能算作撤离。');
  }
  e.seconds = cursor - h.nowSecond; s.lastSecond = cursor;
  s.journal.push({ eventId: h.eventId, revision: h.revision, command: clone(c), host: clone(h),
    beforeSecond: h.nowSecond, afterSecond: cursor, effect: clone(e), masteryGains: { ...masteryGains }, notes: [...notes] });
  return { state: s, effect: e, notes, injuries, masteryGains };
}
/** Exact local replay; the owning chapter separately authenticates the source,
 * real promotion, current private host, budgets and central random receipt. */
export function validateErrorAscentEpilogueState(value: unknown): value is ErrorAscentEpilogueState {
  try {
    const s = value as ErrorAscentEpilogueState;
    if (!s || typeof s !== 'object' || !Array.isArray(s.journal)) return false;
    let replay = createErrorAscentEpilogue({ actorId: s.actorId, week: s.startedWeek, nowSecond: s.startedSecond });
    for (const j of s.journal) replay = applyErrorAscentEpilogue(replay, j.command, j.host).state;
    return stableStringify(replay) === stableStringify(s);
  } catch { return false; }
}
/** Explicit allowlist. Never expose host, check, secret roll or private journal. */
export function projectErrorAscentEpilogue(s: ErrorAscentEpilogueState) {
  const p = s.player, m = s.mechanism;
  const place = p.route === 'OUTSIDE_MAIN' ? '原主门外平台' : p.route === 'OUTSIDE_SIDE' ? '侧阶外街面' :
    p.route === 'SIDE_STAIRS' ? `侧阶第${p.positionMetres}米` : `外廊${p.positionMetres}米处`;
  return { story: s.journal.at(-1)?.notes.join(' ') ?? S.story,
    nextStep: s.status === 'DEAD' ? '本人已经死亡，现场结局与原件损耗保留。' : s.reported ? '撤离记录已完成；既有伤势与机构损耗保留。' : s.status !== 'ACTIVE' ? '交接实际出口、追兵与损耗。' :
      !s.observed ? '看清眼前守卫和原联索，或直接走侧阶离开。' :
      s.player.positionMetres < S.leverMetres ? '可尝试夺走待执行移动的三秒，再实走到原扳杆旁；侧阶随时可走。' :
      m.release.state === 'UNDECLARED' ? '可拨下原扳杆，准备把同一次释放转往内栅栏；也可直接走出仍开着的原门。' :
      m.release.state === 'PENDING' ? '趁原释放尚未发生，尝试一次有限转移并实际走向出口；失败可走侧阶。' :
      m.exit.open ? '实走出同一外门，确认追兵是否真的被原栅栏挡住。' : '外门已闭，沿普通侧阶离开。',
    lines: [
      `本人在${place}，累计实走${p.travelledMetres}米；本场实际经过${s.lastSecond - s.startedSecond}秒，健康损失${p.healthLoss}，新增轻伤${p.injuries.length}处。`,
      `${s.guard.name}（${s.guard.age}岁）是本次独立守卫，在外廊${s.guard.positionMetres}米处，健康${s.guard.health}；${s.guard.status === 'STOPPED_BY_GRILLE' ? '确实被同一内栅栏挡住' : '尚未被原栅栏挡住'}。`,
      `同一外门${m.exit.open ? '开放' : '关闭'}、状况${m.exit.condition}；原内栅栏${m.grille.open ? '吊起' : '落下'}、状况${m.grille.condition}。两原锁扣各一，原联索${m.link.intact ? '完整' : '已切断'}；不产生额外库存。`,
      `短时窃取：${s.theft.applied ? `已实际延迟${s.theft.stolenSeconds}秒、本人利用空隙实走${s.theft.playerMetresDuringDelay}米并发生守卫后续移动，掌握增8` : s.theft.attempted ? '已经尝试，尚无后续实际移动应用' : '未尝试'}。释放转移：${s.diversion.applied ? '同一次原释放已实际作用于内栅栏，掌握增8' : s.diversion.attempted ? '已经尝试，尚无实际转移应用' : '未尝试'}。`,
      '短时窃取实耗1行动、14灵性、6精神、1秒；释放转移实耗1行动、12灵性、6精神、2秒。无需新增购买物，失败照付，各只尝试一次，施术成功本身不增加掌握。',
      '窃取只影响亲见守卫尚未开始的这段移动，最多三秒；转移只利用现存同型锁扣间的原联索，窗口二十秒且只接一次尚待发生的释放。切线、离开近处、停止或超时会限制它。',
      '侧阶始终可普通撤离：实走一步进入、再下二十四米，不消耗行动或现款。已经失去的时间、伤势、费用和原件损耗都不返还。',
    ] };
}
export function getErrorAscentEpilogueActions(s: ErrorAscentEpilogueState, h: ErrorAscentEpilogueHost) {
  const labels: Record<ErrorAscentEpilogueCommand['type'], string> = {
    OBSERVE: '查看守卫、原联索和普通侧阶', STEAL_MOVEMENT: '夺走守卫待执行移动的三秒',
    APPROACH_LEVER: '实走到四米处原扳杆旁', PULL_RELEASE: '拨下原扳杆，排定唯一一次释放',
    DIVERT_RELEASE: '借现存联索把这次释放转往内栅栏', CROSS_EXIT: '沿原路走出同一外门',
    STOP_EFFECTS: '停止剩余有限效果', WAIT_WINDOW: '实际等候二十一秒',
    WITHDRAW: '直接沿普通侧阶撤离', REPORT: '交接实际撤离与损耗',
  };
  const actions = TYPES.map(type => {
    const command: ErrorAscentEpilogueCommand = { type }, e = errorAscentEpilogueCost(s, command, h), reason = errorAscentEpilogueBlock(s, command, h);
    return { command, label: labels[type], enabled: reason === null, reason, preferredAction: false,
      cost: `${e.actions}行动、${e.cashCost}便士、${e.spirituality}灵性、${e.mind}精神，实际${e.seconds}秒${cast(command) ? '；一次尝试，失败照付，须后续实际应用才增掌握' : ''}` };
  });
  const available = (type: ErrorAscentEpilogueCommand['type']) => actions.some(a => a.command.type === type && a.enabled);
  let next: ErrorAscentEpilogueCommand['type'];
  if (s.status !== 'ACTIVE') next = 'REPORT';
  else if (!s.observed) next = 'OBSERVE';
  else if (available('STEAL_MOVEMENT')) next = 'STEAL_MOVEMENT';
  else if (s.theft.attempted && !s.theft.passed) next = 'WITHDRAW';
  else if (s.player.positionMetres < S.leverMetres) next = 'APPROACH_LEVER';
  else if (s.mechanism.release.state === 'UNDECLARED') next =
    h.actions >= P.diversion.actions && h.spirituality >= P.diversion.spirituality && h.mind > P.diversion.mind && s.mechanism.link.intact ? 'PULL_RELEASE' : 'CROSS_EXIT';
  else if (available('DIVERT_RELEASE')) next = 'DIVERT_RELEASE';
  else if (s.diversion.attempted && !s.diversion.passed) next = 'WITHDRAW';
  else next = s.mechanism.exit.open ? 'CROSS_EXIT' : 'WITHDRAW';
  const preferred = actions.find(a => a.command.type === next && a.enabled) ?? actions.find(a => a.command.type === 'WITHDRAW' && a.enabled);
  if (preferred) preferred.preferredAction = true;
  return actions;
}
