import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { fateProphetAbilityWheel } from '../../src/domain/fate-prophet/combat.js';
import { resolveMercurySnakeCombatRound } from '../../src/domain/slice/mercury-snake-combat.js';
import { MERCURY_SNAKE_COUNT_WHEEL, MERCURY_SNAKE_ENEMY_COUNT_WHEEL, MERCURY_SNAKE_ENEMY_ABILITY_WHEEL, RESTART, ANCHOR, FORESIGHT, HAZARD,
  mercurySnakeAbilityWheel, mercurySnakeActionCount, mercurySnakeEnemyActionCount, currentMercurySnakeCombatSource, replayMercurySnakeCombatRound,
  validMercurySnakeCombatSource, validateMercurySnakeCombatRound, validateMercurySnakeRoundOutcome, nextMercurySnakeCombatSource, projectMercurySnakeCombat,
  createMercurySnakeRuntime, resolveMercurySnakePlayerSlot, resolveMercurySnakeEnemySlot, advanceMercurySnakeCombatClock, drawMercurySnakeEnemyAbility,
  type MercurySnakeCombatSource, type MercurySnakeRoundOutcome } from '../../src/domain/mercury-snake/combat.js';
import { MERCURY_SNAKE_POLICIES, projectMercurySnakeEncounter, validateMercurySnakeEncounter, mercurySnakeApproachedSite,
  mercurySnakeFinanceSnapshot, mercurySnakeCompletedBudgetMatches, leaveMercurySnakeCombatSite, type MercurySnakePolicy } from '../../src/domain/mercury-snake/encounter.js';
import { MERCURY_SNAKE_CASE_IDS } from '../../src/domain/mercury-snake/life.js';
import { ms, directedInitial2, prepareBottle, dose, ready, originalFateProphet, oldWheelRoots, rejectMercurySnake } from './mercury-snake-directed-helper.js';
let practicedCache: SliceState | undefined;
function practiced(): SliceState {
  if (!practicedCache) {
    // Explicit UNIT-only budget before any new-stage journal. No source roots, luck, skills or injuries are rewritten.
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 3;
    let s = ms(prepareBottle(initial, dose.bottleId), dose); expect(s.progression.sequence).toBe(1);
    for (const caseId of MERCURY_SNAKE_CASE_IDS) {
      s = ms(ready(s, { ap: 2 }), { type: 'OBSERVE', caseId }); s = ms(s, { type: 'CONSENT', caseId, permission: 'OWNER' });
      s = ms(s, { type: 'INVITE', caseId }); s = ms(s, { type: 'START_ORDINARY', caseId });
      for (const type of ['WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A', 'RELEASE_CART', 'WALK_TO_B', 'PUSH_BACK', 'RETURN_OBJECT', 'RETURN_TO_ENTRY', 'LEAVE'] as const) s = ms(s, { type, caseId });
      s = ms(ready(s), { type: 'REPORT', caseId });
    }
    s = ms(ready(s), { type: 'REFLECT' }); assertValidSliceState(s); practicedCache = s;
  }
  return structuredClone(practicedCache);
}
function start(policy: MercurySnakePolicy = 'ALL', zeroAP = false, accumulate = false): SliceState {
  let s = practiced();
  if (accumulate) s = ms(ready(s, { afterWeek: s.mercurySnake.luck.lastAccumulateWeek ?? 0 }), { type: 'ACCUMULATE' });
  s = ready(s, { ap: 3, cash: 30, mind: 70, spirituality: 90 });
  while (s.actionsRemaining > (zeroAP ? 2 : 3)) s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
  s = ms(s, { type: 'PREPARE_ENCOUNTER' }); s = ms(s, { type: 'ENCOUNTER_TALK' });
  if (policy !== 'ALL') s = ms(s, { type: 'SET_COMBAT_POLICY', policy }); return ms(s, { type: 'ENCOUNTER_FIGHT' });
}
const source = () => currentMercurySnakeCombatSource(start())!;
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'mercury-snake-declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const value = rolls[cursor++]; if (value === undefined || value < min || value > max) throw new Error(`Unexpected declared UNIT draw ${value} in ${min}..${max}`); return value; } }; }
function scripted(rolls: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; });
}
afterEach(() => vi.restoreAllMocks());
function costs(o: MercurySnakeRoundOutcome): void {
  const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order); let clock = o.source.site.clockSeconds;
  for (const [i, a] of actions.entries()) { expect(a.order).toBe(i); expect(a.atSeconds).toBe(clock); expect(a.elapsedSeconds).toBe(5); clock += 5; }
  expect(o.elapsedSeconds).toBe(60); expect(o.siteAfter.clockSeconds).toBe(o.source.site.clockSeconds + 60);
  expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.enemySpirituality).toBe(o.source.body.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.piece!.charges).toBe(o.source.body.piece!.charges - actions.reduce((n, a) => n + a.pieceChargePaid, 0));
  expect(o.piece!.wear).toBe(o.restartApplications + o.anchorApplications); expect(o.plates.filter(p => p.status === 'SPENT')).toHaveLength(o.powerUses.MIND_SPIKE);
  expect(o.luckAfter).toEqual({ ...o.source.luck, stored: o.source.luck.stored - o.playerActions.reduce((n, a) => n + a.luckCost, 0), spent: o.source.luck.spent + o.playerActions.reduce((n, a) => n + a.luckCost, 0) });
  expect(o.siteAfter.cart).toEqual(o.source.site.cart); expect(o.siteAfter.parcel).toEqual(o.source.site.parcel); expect(o.siteAfter.volunteer).toEqual(o.source.site.volunteer); expect(o.operationAfter).toEqual(o.source.operation);
  expect(o.siteAfter.playerTravelMetres).toBe(o.source.site.playerTravelMetres + o.playerActions.reduce((n, a) => n + a.travelMetres, 0) + o.enemyActions.reduce((n, a) => n + a.impulseMetres + a.returnedMetres, 0));
  for (const a of o.playerActions.filter(a => a.id === RESTART || a.id === ANCHOR)) { expect(a.paidCost).toBe(a.attempted ? 8 : 0); expect(a.mindCost).toBe(a.attempted ? a.succeeded ? 2 : 4 : 0); expect(a.pieceChargePaid).toBe(0); }
  for (const a of o.enemyActions) { expect(a.threatens).toBe(a.attackKind === 'BODY' && a.selfGain > 0); expect(a.mentalPressure).toBe(a.attackKind === 'MENTAL' && a.selfGain > 0);
    if (a.windowsApplied.length) { expect(a.attackKind).toBe('BODY'); expect(a.id).toBe('BODY_STRIKE'); expect(a.impulseMetres).toBe(1); expect(a.returnedMetres).toBe(1); expect(a.windowsApplied.reduce((n, w) => n + w.amount, 0)).toBeLessThanOrEqual(30); expect(a.playerPositionAfter).toBe(a.playerPositionBefore); }
  }
  for (const [id, value] of Object.entries(o.source.inheritedMastery)) expect(o.masteryAfter[id]).toBe(value);
  for (const id of [RESTART, ANCHOR]) expect(o.masteryAfter[id]).toBe(Math.min(500, o.source.mastery[id]! + 8 * actions.filter(a => a.masteryApplied.includes(id)).length));
}

describe('Mercury Snake original703 history, finite local position response and full-source finance replay', () => {
  it('retains old surrenderedRowan,17 skills/six zeros, actual0luck ledger and sourceS2 six weights, with S1 six-action tickets', () => {
    const original = originalFateProphet(), s = start(), inherited = start('INHERITED_ONLY');
    expect(oldWheelRoots(s)).toEqual(oldWheelRoots(original)); expect(s.fateProphet.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 83 });
    expect(s.mercurySnake.luck).toEqual({ stored: 0, accumulated: 14, spent: 14, lastAccumulateWeek: 176 });
    expect(s.mercurySnake.sourceScene!.originals.operation).toEqual(original.fateProphet.life.operation);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) expect(mercurySnakeAbilityWheel(inherited, stance).map(({ id, weight }) => ({ id, weight }))).toEqual(fateProphetAbilityWheel(original, stance).map(({ id, weight }) => ({ id, weight })));
    const weights = [30, 15, 20, 20, 10, 5, 20, 20]; mercurySnakeAbilityWheel(s, null).forEach((r, i) => expect(r.weight).toBeCloseTo(weights[i]! / 140 * 100));
    expect(MERCURY_SNAKE_POLICIES).toEqual(['INHERITED_ONLY', 'RESTART', 'ANCHOR', 'ALL', 'ORDINARY']); expect(MERCURY_SNAKE_COUNT_WHEEL).toEqual(MERCURY_SNAKE_ENEMY_COUNT_WHEEL);
    const counts = Array.from({ length: 100 }, (_, i) => mercurySnakeActionCount(i + 1)); expect([1, 2, 3, 4, 5, 6].map(n => counts.filter(v => v === n).length)).toEqual([10, 15, 25, 25, 15, 10]); expect(counts).toEqual(Array.from({ length: 100 }, (_, i) => mercurySnakeEnemyActionCount(i + 1)));
    expect([1, 36, 56, 81, 91, 96].map(n => drawMercurySnakeEnemyAbility(random(n)))).toEqual(['MIND_SPIKE', 'WARD', 'BODY_STRIKE', 'CALM', 'REPOSITION', 'ACCIDENT']);
    expect(projectMercurySnakeEncounter(s).enemyAbilityWheel).toEqual(MERCURY_SNAKE_ENEMY_ABILITY_WHEEL);
  }, 180_000);
  it('walks both original adults truly outside, preserves originals and the old mechanical receipt, then walks player4m to new adult', () => {
    const s = start(), e = s.mercurySnake.encounter, p = e.startSite!;
    expect(p.volunteer.location).toBe('A'); expect(p.guide.location).toBe('A'); expect(e.currentSite).toEqual(mercurySnakeApproachedSite(p, s.mercurySnake.sourceScene!.originals));
    expect(e.currentSite!.clockSeconds).toBe(p.clockSeconds + 20); expect(e.currentSite!.playerTravelMetres).toBe(p.playerTravelMetres + 4); expect(e.currentSite!.guideTravelMetres).toBe(p.guideTravelMetres + 8);
    expect(e.currentSite!.volunteer).toEqual({ ...p.volunteer, location: 'OUTSIDE' }); expect(e.currentSite!.guide.location).toBe('OUTSIDE');
    for (const key of ['cart', 'parcel', 'pouch', 'tags', 'disc', 'record'] as const) expect(e.currentSite![key]).toEqual(p[key]);
    expect(e.startSource).toMatchObject({ targetId: 'MS1-OSWIN', targetName: '奥斯温·贝尔', targetAge: 44, maxActionCount: 6, enemyWeapon: 'MS1-OSWIN-ROD', enemyDistanceMetres: 2 });
    expect(e.piece).toMatchObject({ charges: 3, wear: 0, paidPennies: 30 }); expect(e.plates.map(p => p.id)).toEqual(['MS1-OSWIN-PLATE-1', 'MS1-OSWIN-PLATE-2', 'MS1-OSWIN-PLATE-3']); rejectMercurySnake(s, { type: 'PREPARE_ENCOUNTER' });
  }, 120_000);
  it('applies one paid local restart only to actual unsettledBODY displacement, without restoring resources or deleting the attack', () => {
    const x = source(), r = createMercurySnakeRuntime(x), original = structuredClone(x); const cast = resolveMercurySnakePlayerSlot(x, r, RESTART, 0, random(1));
    expect(cast).toMatchObject({ attempted: true, succeeded: true, paidCost: 8, mindCost: 2, pieceChargePaid: 0 }); expect(r.body.piece!.charges).toBe(3);
    const hit = resolveMercurySnakeEnemySlot(x, r, 'BODY_STRIKE', 1, random()); expect(hit).toMatchObject({ id: 'BODY_STRIKE', planned: 'BODY_STRIKE', selfGain: 0, rawContribution: 25, attackKind: 'BODY', impulseMetres: 1, returnedMetres: 1, pieceChargePaid: 1, pieceWearPaid: 1, travelMetres: 4 });
    expect(hit.windowsApplied).toEqual([{ kind: 'RESTART', round: 1, order: 0, amount: 25 }]); expect(r.body.playerLocalMetres).toBe(0); expect(r.body.piece!.charges).toBe(2); expect(r.root.clockSeconds).toBe(x.site.clockSeconds + 10); expect(r.root.playerTravelMetres).toBe(x.site.playerTravelMetres + 2);
    expect(r.playerS).toBe(x.playerSpirituality - 8); expect(r.playerM).toBe(x.playerMind - 2); expect(r.mastery[RESTART]).toBe(x.mastery[RESTART]! + 8); expect(x).toEqual(original);
    const q = createMercurySnakeRuntime(x); resolveMercurySnakePlayerSlot(x, q, RESTART, 0, random(1)); const mind = resolveMercurySnakeEnemySlot(x, q, 'MIND_SPIKE', 1, random());
    expect(mind).toMatchObject({ selfGain: 75, attackKind: 'MENTAL', paidCost: 7, pieceChargePaid: 0, impulseMetres: 0, returnedMetres: 0 }); expect(q.body.plates.filter(p => p.status === 'SPENT')).toHaveLength(1); expect(q.body.enemySpirituality).toBe(113); expect(q.body.piece!.charges).toBe(3);
  }, 120_000);
  it('anchor alone grants no reduction; a later separately paid restart consumes exactly2 charges within the original20s, never renews', () => {
    const x = source(), r = createMercurySnakeRuntime(x); resolveMercurySnakePlayerSlot(x, r, ANCHOR, 0, random(1));
    const until = r.body.anchor!.expiresAt; expect(resolveMercurySnakePlayerSlot(x, r, ANCHOR, 1, random())).toMatchObject({ attempted: false, paidCost: 0 }); expect(r.body.anchor!.expiresAt).toBe(until);
    const alone = resolveMercurySnakeEnemySlot(x, r, 'BODY_STRIKE', 2, random()); expect(alone).toMatchObject({ selfGain: 25, returnedMetres: 0, pieceChargePaid: 0 }); expect(r.body.playerLocalMetres).toBe(1); expect(r.body.anchor).toBeNull();
    const q = createMercurySnakeRuntime(x); resolveMercurySnakePlayerSlot(x, q, ANCHOR, 0, random(1)); resolveMercurySnakePlayerSlot(x, q, RESTART, 1, random(1)); advanceMercurySnakeCombatClock(q, 5);
    const hit = resolveMercurySnakeEnemySlot(x, q, 'BODY_STRIKE', 2, random()); expect(hit).toMatchObject({ selfGain: 0, pieceChargePaid: 2, pieceWearPaid: 2, returnedMetres: 1 }); expect(hit.windowsApplied).toEqual([{ kind: 'RESTART', round: 1, order: 1, amount: 25 }, { kind: 'ANCHOR', round: 1, order: 0, amount: 0 }]);
    expect(q.playerS).toBe(x.playerSpirituality - 16); expect(q.playerM).toBe(x.playerMind - 4); expect(q.body.piece).toMatchObject({ charges: 1, wear: 2 }); expect(q.body.restart).toBeNull(); expect(q.body.anchor).toBeNull();
    const expired = createMercurySnakeRuntime(x); resolveMercurySnakePlayerSlot(x, expired, ANCHOR, 0, random(1)); resolveMercurySnakePlayerSlot(x, expired, RESTART, 1, random(1)); advanceMercurySnakeCombatClock(expired, 10); expect(expired.body.anchor).toBeNull(); expect(expired.body.restart).toBeNull(); expect(resolveMercurySnakeEnemySlot(x, expired, 'BODY_STRIKE', 2, random()).pieceChargePaid).toBe(0);
  }, 120_000);
  it('failure costs8S4M; own movement, opponent reposition, concealment/cancel and true expiry invalidate without refunds or mastery', () => {
    const x = source(), failed = createMercurySnakeRuntime(x); expect(resolveMercurySnakePlayerSlot(x, failed, RESTART, 0, random(100))).toMatchObject({ succeeded: false, paidCost: 8, mindCost: 4, pieceChargePaid: 0 }); expect(failed.body.restart).toBeNull(); expect(failed.body.piece!.charges).toBe(3);
    for (const enemy of ['REPOSITION', 'CALM'] as const) { const r = createMercurySnakeRuntime(x); resolveMercurySnakePlayerSlot(x, r, ANCHOR, 0, random(1)); resolveMercurySnakePlayerSlot(x, r, RESTART, 1, random(1)); const cancelled = resolveMercurySnakeEnemySlot(x, r, enemy, 2, random()); expect(cancelled.windowsCancelled).toHaveLength(2); expect(r.body.restart).toBeNull(); expect(r.body.anchor).toBeNull(); expect(r.body.piece!.charges).toBe(3); expect(r.playerS).toBe(x.playerSpirituality - 16); expect(r.mastery[RESTART]).toBe(x.mastery[RESTART]); }
    const moved = createMercurySnakeRuntime(x); resolveMercurySnakePlayerSlot(x, moved, RESTART, 0, random(1)); resolveMercurySnakePlayerSlot(x, moved, 'BODY_STRIKE', 1, random()); expect(moved.body.restart).toBeNull(); expect(moved.body.piece!.charges).toBe(3);
    const expired = createMercurySnakeRuntime(x); resolveMercurySnakePlayerSlot(x, expired, RESTART, 0, random(1)); advanceMercurySnakeCombatClock(expired, 5); expect(expired.body.restart).toBeNull();
  }, 120_000);
  it('zero charges and oldluck0 forbid free new applications or hazard; actual accumulated1 luck is consumed once without changing old roots', () => {
    const x = source(), r = createMercurySnakeRuntime(x, 'SPEND_FIRST');
    for (let i = 0; i < 3; i++) { resolveMercurySnakePlayerSlot(x, r, RESTART, i * 2, random(1)); resolveMercurySnakeEnemySlot(x, r, 'BODY_STRIKE', i * 2 + 1, random()); }
    expect(r.body.piece).toMatchObject({ charges: 0, wear: 3 }); expect(resolveMercurySnakePlayerSlot(x, r, RESTART, 6, random())).toMatchObject({ attempted: false, paidCost: 0 });
    const old = resolveMercurySnakePlayerSlot(x, r, HAZARD, 7, random()); expect(old).toMatchObject({ selectedAbility: 'wheel.s6.mental-storm', paidCost: 3, luckCost: 0, attackKind: 'MENTAL' }); expect(r.luck).toEqual(x.luck);
    const s = start('ALL', false, true), roots = oldWheelRoots(s), z = currentMercurySnakeCombatSource(s)!, q = createMercurySnakeRuntime(z, 'SPEND_FIRST'); expect(z.luck.stored).toBe(1);
    expect(resolveMercurySnakePlayerSlot(z, q, HAZARD, 0, random(1))).toMatchObject({ selectedAbility: HAZARD, paidCost: 5, mindCost: 1, luckCost: 1 }); expect(q.luck.stored).toBe(0); expect(q.luck.spent).toBe(z.luck.spent + 1); expect(oldWheelRoots(s)).toEqual(roots);
    const ordinary = currentMercurySnakeCombatSource(start('ORDINARY'))!, t = createMercurySnakeRuntime(ordinary, 'SPEND_FIRST'); for (const id of [FORESIGHT, HAZARD, RESTART, ANCHOR] as const) expect(resolveMercurySnakePlayerSlot(ordinary, t, id, 0, random())).toMatchObject({ paidCost: 0, mindCost: 0, luckCost: 0 });
  }, 180_000);
  it('three original mental plates are actually consumed and not refilled; publicBODY andMENTAL consequences match resolver', () => {
    const x = source(), r = createMercurySnakeRuntime(x);
    for (let i = 0; i < 3; i++) expect(resolveMercurySnakeEnemySlot(x, r, 'MIND_SPIKE', i, random())).toMatchObject({ id: 'MIND_SPIKE', paidCost: 7, attackKind: 'MENTAL' });
    expect(r.body.enemySpirituality).toBe(99); expect(resolveMercurySnakeEnemySlot(x, r, 'MIND_SPIKE', 3, random())).toMatchObject({ id: 'BODY_STRIKE', planned: 'MIND_SPIKE', paidCost: 0, attackKind: 'BODY', impulseMetres: 1 });
    let spy = scripted([1, 1, 1, 341, 1, 1_000_000]); const mental = replayMercurySnakeCombatRound(x, 'PREPARE').round; spy.mockRestore(); expect(mental.consequenceDomain).toBe('MENTAL'); expect(mental.consequenceWeights).toBeNull(); expect(mental.consequenceRoll).toBeUndefined(); expect(mental.mercurySnakeOutcome!.playerHealthAfter).toBe(x.playerHealth); expect(mental.mercurySnakeOutcome!.playerRiskAfter).toBe(x.playerRisk);
    spy = scripted([1, 1, 1, 341, 56, 1_000_000, 10]); const physical = replayMercurySnakeCombatRound(x, 'PREPARE').round; spy.mockRestore(); expect(physical.consequenceDomain).toBe('BODY'); expect(physical.mercurySnakeOutcome!.playerHealthAfter).toBe(x.playerHealth - 10);
    spy = scripted([1, 1, 1, 411, 1, 56, 1_000_000]); const returned = replayMercurySnakeCombatRound(x, 'PREPARE').round; spy.mockRestore(); expect(returned.mercurySnakeOutcome!.restartApplications).toBe(1); expect(returned.mercurySnakeOutcome!.enemyActions[0]).toMatchObject({ planned: 'BODY_STRIKE', travelMetres: 4, impulseMetres: 1, returnedMetres: 1 }); costs(returned.mercurySnakeOutcome!);
    const displaced = nextMercurySnakeCombatSource(physical.mercurySnakeOutcome!), restored = nextMercurySnakeCombatSource(returned.mercurySnakeOutcome!);
    expect([displaced.body.playerLocalMetres, restored.body.playerLocalMetres]).toEqual([1, 0]); expect([displaced.enemyDistanceMetres, restored.enemyDistanceMetres]).toEqual([3, 2]);
    for (const next of [displaced, restored]) {
      expect(validMercurySnakeCombatSource(next)).toBe(true); expect(next.randomCursor).toBe(next === displaced ? physical.mercurySnakeOutcome!.randomCursorAfter : returned.mercurySnakeOutcome!.randomCursorAfter);
      const wrong = structuredClone(next); wrong.enemyDistanceMetres = next.enemyDistanceMetres === 2 ? 3 : 2; expect(validMercurySnakeCombatSource(wrong)).toBe(false);
    }
    const later = createMercurySnakeRuntime(displaced); resolveMercurySnakePlayerSlot(displaced, later, RESTART, 0, random(1));
    expect(resolveMercurySnakeEnemySlot(displaced, later, 'BODY_STRIKE', 1, random())).toMatchObject({ playerPositionBefore: 1, playerPositionAfter: 1, travelMetres: 6, impulseMetres: 1, returnedMetres: 1, pieceChargePaid: 1 });
    expect(later.playerS).toBe(displaced.playerSpirituality - 8); expect(later.playerM).toBe(displaced.playerMind - 2); expect(later.root.clockSeconds).toBe(displaced.site.clockSeconds + 10);
    const invalidated = createMercurySnakeRuntime(displaced); resolveMercurySnakePlayerSlot(displaced, invalidated, RESTART, 0, random(1)); resolveMercurySnakePlayerSlot(displaced, invalidated, 'BODY_STRIKE', 1, random());
    expect(resolveMercurySnakeEnemySlot(displaced, invalidated, 'BODY_STRIKE', 2, random())).toMatchObject({ playerPositionBefore: 1, playerPositionAfter: 0, travelMetres: 6, impulseMetres: 1, returnedMetres: 0, pieceChargePaid: 0 });
    expect(invalidated.playerS).toBe(displaced.playerSpirituality - 8); expect(invalidated.playerM).toBe(displaced.playerMind - 2); expect(invalidated.root.clockSeconds).toBe(displaced.site.clockSeconds + 15); expect(invalidated.body.piece!.charges).toBe(displaced.body.piece!.charges);
  }, 120_000);
  it('keeps deterministic exact replay/core15/20/40/25, inherited passive and current source after continuing rounds', () => {
    const x = source(), s = start(), untouched = structuredClone(s), result = replayMercurySnakeCombatRound(x, 'CONTROL'); costs(result.round.mercurySnakeOutcome!);
    expect(replayMercurySnakeCombatRound(x, 'CONTROL')).toEqual(result); expect(validateMercurySnakeRoundOutcome(result.round.mercurySnakeOutcome)).toBe(true); expect(validateMercurySnakeCombatRound(result.round)).toBe(true); expect(resolveMercurySnakeCombatRound(s, 'CONTROL')).toEqual(result); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(untouched));
    if (result.outcome === 'CONTINUE') {
      s.combatHistory.push(result.round); s.revision++; const next = nextMercurySnakeCombatSource(result.round.mercurySnakeOutcome!);
      expect(currentMercurySnakeCombatSource(s)).toEqual(next); expect(next.enemyDistanceMetres).toBe(2 + next.body.playerLocalMetres); expect(validMercurySnakeCombatSource(next)).toBe(true);
      const staleDistance = structuredClone(next); staleDistance.enemyDistanceMetres = next.enemyDistanceMetres === 2 ? 3 : 2;
      expect(validMercurySnakeCombatSource(staleDistance)).toBe(false); expect(() => replayMercurySnakeCombatRound(staleDistance, 'CONTROL')).toThrow();
    }
    const spy = scripted([100, 1, 1, 341, 96, 1]); const neutral = replayMercurySnakeCombatRound(x, 'PREPARE').round; spy.mockRestore();
    const penalty = (n: number, max: number) => n / max > .75 ? 0 : n / max > .5 ? .05 : n / max > .25 ? .1 : .2;
    expect(neutral.playerAdvantage).toBe((1500 + Math.min(300, x.physique * .15 + x.perception * .2 + x.will * .4 + x.knowledge * .25)) * (1 - Math.min(.4, penalty(x.playerHealth, 100) + penalty(x.playerMind, 100) + penalty(x.playerSpirituality, 120)))); expect(neutral.passiveLuck).toEqual({ roll: 100, triggered: false, bonus: 0 });
  }, 120_000);
  it('public S1 winnerPolicy defaults exactly toHOLD, spends only actual new-root luck, rejects wrong source and accepts actual6 but rejects7 enemy actions', () => {
    const before = start('ALL', false, true), unchanged = structuredClone(before), roots = oldWheelRoots(before);
    expect(before.progression).toMatchObject({ pathwayId: 'wheel', sequence: 1 }); expect(before.mercurySnake.luck.stored).toBe(1); expect(roots).toHaveLength(8);
    const accumulation = before.mercurySnake.life.journal.find(e => e.command.type === 'ACCUMULATE')!;
    expect(accumulation).toBeDefined(); expect(accumulation.paid.actions).toBe(1); expect(accumulation.before.luck.stored).toBe(0); expect(accumulation.after.luck.stored).toBe(1);
    const implicit = applySliceIntent(before, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
    const explicit = applySliceIntent(before, { type: 'COMBAT_ROUND', stance: 'CONTROL', winnerPolicy: 'HOLD' });
    expect(explicit).toEqual(implicit); expect(explicit.random).toEqual(implicit.random); expect(explicit.mercurySnake.luck).toEqual(before.mercurySnake.luck);
    expect(explicit.combatHistory.at(-1)!.mercurySnakeOutcome!.winnerPolicy).toBe('HOLD'); expect(before).toEqual(unchanged);
    assertValidSliceState(implicit); assertValidSliceState(explicit);

    // Declared UNIT draws, scoped by original seed and actual starting cursor. Cursor-indexed replay
    // returns identical tickets to public validation; no state, ledger, history or cursor is fabricated.
    const original = DeterministicActionRandomStream.prototype.nextInt, seed = before.random.seed, cursor = before.random.cursor;
    const values = [100, 1, 100, 261, 1, 1, 1, 1, 36, 56, 81, 1] as const;
    const maxima = [100, 100, 100, 600, 100, 100, 100, 100, 100, 100, 100, 1_000_000] as const;
    const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
      const at = this.cursor, natural = original.call(this, min, max), index = at - cursor;
      if (this.seed !== seed || index < 0 || index >= values.length) return natural;
      expect([min, max]).toEqual([1, maxima[index]]); return values[index]!;
    });
    try {
      const spent = applySliceIntent(before, { type: 'COMBAT_ROUND', stance: 'CONTROL', winnerPolicy: 'SPEND_FIRST' });
      const round = spent.combatHistory.at(-1)!, o = round.mercurySnakeOutcome!;
      expect(o.winnerPolicy).toBe('SPEND_FIRST'); expect(o.playerActions[0]).toMatchObject({ selectedAbility: HAZARD, paidCost: 5, mindCost: 1, luckCost: 1 });
      expect(spent.mercurySnake.luck).toEqual({ ...before.mercurySnake.luck, stored: 0, spent: before.mercurySnake.luck.spent + 1 });
      expect(oldWheelRoots(spent)).toEqual(roots); expect(spent.winner.luck).toEqual(before.winner.luck); expect(spent.mercurySnake.sourceHistory).toEqual(before.mercurySnake.sourceHistory); expect(spent.mercurySnake.sourceScene).toEqual(before.mercurySnake.sourceScene);
      expect(spent.random).toEqual({ ...before.random, cursor: cursor + values.length }); expect(before).toEqual(unchanged);
      expect(round.enemyCountRoll).toBe(100); expect(round.enemyCount).toBe(6); expect(o.enemyActions).toHaveLength(6); expect(round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(6);
      expect(o.enemyActions.map(a => a.planned)).toEqual(['MIND_SPIKE', 'MIND_SPIKE', 'MIND_SPIKE', 'WARD', 'BODY_STRIKE', 'CALM']); expect(o.enemySpirituality).toBe(92); expect(o.plates.filter(p => p.status === 'SPENT')).toHaveLength(3);
      expect(validateMercurySnakeCombatRound(round)).toBe(true); assertValidSliceState(spent);
      const seven = structuredClone(spent); seven.combatHistory.at(-1)!.enemyCount = 7; seven.combat!.lastRound!.enemyCount = 7; seven.lastCombatRound!.enemyCount = 7;
      expect(validateMercurySnakeCombatRound(seven.combatHistory.at(-1)!)).toBe(false); expect(() => assertValidSliceState(seven)).toThrow();
    } finally { spy.mockRestore(); }
    const wrong = structuredClone(before); wrong.combat!.encounterId = 'FATE_PROPHET_DISPUTE'; const wrongUnchanged = structuredClone(wrong);
    expect(wrong.progression.sequence).toBe(1);
    for (const winnerPolicy of ['HOLD', 'SPEND_FIRST'] as const) expect(() => applySliceIntent(wrong, { type: 'COMBAT_ROUND', stance: 'CONTROL', winnerPolicy })).toThrow('幸运储备策略只供赢家本回合明确选择。');
    expect(wrong).toEqual(wrongUnchanged); expect(wrong.random).toEqual(before.random); expect(oldWheelRoots(wrong)).toEqual(roots);
  }, 180_000);
  it('rejects forged finite resources, actual source scene, old luck, fees, time, RNG and phantom body consequences', () => {
    const x = source(); expect(validMercurySnakeCombatSource(x)).toBe(true);
    const sourceBad = (mutate: (v: MercurySnakeCombatSource) => void) => { const v = structuredClone(x); mutate(v); expect(validMercurySnakeCombatSource(v)).toBe(false); expect(() => replayMercurySnakeCombatRound(v, 'CONTROL')).toThrow(); };
    sourceBad(v => v.maxActionCount = 7 as 6); sourceBad(v => v.round = 0); sourceBad(v => v.site.clockSeconds++); sourceBad(v => v.site.volunteer.location = 'A'); sourceBad(v => v.body.enemyHealth = 90); sourceBad(v => v.body.piece!.charges = 4); sourceBad(v => v.body.piece!.charges = 2); sourceBad(v => v.luck.stored = 1); sourceBad(v => v.budget.luck.spent--); sourceBad(v => v.operation.mechanical = null); sourceBad(v => v.inheritedMastery['wheel.s7.passive-luck'] = 1); sourceBad(v => v.targetId = 'FP2-ROWAN' as typeof v.targetId); sourceBad(v => v.preparation.after.cash++);
    const round = replayMercurySnakeCombatRound(x, 'CONTROL').round; const bad = (mutate: (r: SliceCombatRound) => void) => { const r = structuredClone(round); mutate(r); expect(validateMercurySnakeCombatRound(r)).toBe(false); };
    bad(r => r.playerCount = 7); bad(r => r.mercurySnakeOutcome!.randomCursorAfter++); bad(r => r.mercurySnakeOutcome!.playerSpiritualityAfter++); bad(r => r.mercurySnakeOutcome!.elapsedSeconds = 59 as 60); bad(r => r.mercurySnakeOutcome!.piece!.charges++); bad(r => r.mercurySnakeOutcome!.enemySpirituality++); bad(r => r.mercurySnakeOutcome!.luckAfter.stored++); bad(r => r.mercurySnakeOutcome!.masteryAfter[RESTART]!++); bad(r => r.consequenceRoll = null as unknown as number);
  }, 120_000);
  it('supports lastAP preparation and0AP peaceful exit with exact weekly finance and no refunds', () => {
    for (const talk of [false, true]) {
      let s = ready(practiced(), { cash: 30 }); while (s.actionsRemaining > 1) s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
      s = ms(s, { type: 'PREPARE_ENCOUNTER' }); expect(s.actionsRemaining).toBe(0); const prepared = structuredClone(s.mercurySnake.encounter.piece);
      if (talk) s = ms(s, { type: 'ENCOUNTER_TALK' }); const before = structuredClone(s.mercurySnake.encounter.currentSite!); rejectMercurySnake(s, { type: 'ENCOUNTER_FIGHT' }); s = ms(s, { type: 'LEAVE_ENCOUNTER' });
      expect(s.mercurySnake.encounter.currentSite).toEqual({ ...before, playerLocation: 'START', clockSeconds: before.clockSeconds + (talk ? 4 : 0), playerTravelMetres: before.playerTravelMetres + (talk ? 4 : 0) }); expect(s.mercurySnake.encounter.piece).toEqual(prepared); expect(validateMercurySnakeEncounter(s)).toBe(true); assertValidSliceState(s);
      const last = s.mercurySnake.encounter.journal.at(-1)!; expect(mercurySnakeCompletedBudgetMatches(s, last.after, last.finance, last.week, last.date, last.revision, last.randomCursor, '沿普通路和平离开相邻院落')).toBe(true);
      const bad = mercurySnakeFinanceSnapshot(last.finance); bad.debts.push({ id: 'forged', source: '不存在的欠款', remaining: 50, weeklyPayment: 5, createdWeek: last.week }); expect(mercurySnakeCompletedBudgetMatches(s, last.after, bad, last.week, last.date, last.revision, last.randomCursor, '沿普通路和平离开相邻院落')).toBe(false);
    }
  }, 180_000);
  it('settles sameweek and true0AP combat terminals against actual finance, preserves old roots and pays current offset before4m exit', () => {
    for (const zero of [false, true]) {
      let s = start('ALL', zero); const roots = oldWheelRoots(s), week = s.week; expect(s.actionsRemaining).toBe(zero ? 0 : 1);
      for (let count = 0; count < 90 && s.combat; count++) s = applySliceIntent(s, { type: 'COMBAT_ROUND', stance: 'RETREAT' });
      expect(s.combat).toBeNull(); expect(s.mercurySnake.encounter.terminal).not.toBeNull(); expect(validateMercurySnakeEncounter(s)).toBe(true); assertValidSliceState(s); expect(oldWheelRoots(s)).toEqual(roots);
      const e = s.mercurySnake.encounter, terminal = e.terminal!, o = s.combatHistory[terminal.historyIndex]!.mercurySnakeOutcome!, fight = e.journal.at(-1)!;
      expect(o.source.enemyDistanceMetres).toBe(2 + o.source.body.playerLocalMetres);
      expect(terminal.exitMetres).toBe(s.status === 'DEAD' ? 0 : 4 + o.playerLocalMetres); expect(e.currentSite!.clockSeconds).toBe(o.siteAfter.clockSeconds + terminal.exitSeconds); expect(e.currentSite!.playerTravelMetres).toBe(o.siteAfter.playerTravelMetres + terminal.exitMetres); expect(e.currentSite!.volunteer.location).toBe('OUTSIDE');
      expect(s.week).toBe(week + (zero && s.status === 'ACTIVE' ? 1 : 0)); const expected = { ...fight.after, health: o.playerHealthAfter, mind: o.playerMindAfter, spirituality: o.playerSpiritualityAfter, mastery: o.masteryAfter, injuries: o.playerInjuriesAfter, injuryRisk: o.playerRiskAfter, luck: o.luckAfter };
      expect(mercurySnakeCompletedBudgetMatches(s, expected, fight.finance, fight.week, fight.date, o.source.revision + 1, o.randomCursorAfter, '奥斯温的相邻院落冲突结束')).toBe(true); expect(projectMercurySnakeCombat(s).lastActionSequence.length).toBe(o.playerActions.length + o.enemyActions.length);
    }
    for (const offset of [0, 1] as const) { const p = structuredClone(source().site), clock = p.clockSeconds, travelled = p.playerTravelMetres; leaveMercurySnakeCombatSite(p, offset); expect(p.clockSeconds).toBe(clock + 4 + offset); expect(p.playerTravelMetres).toBe(travelled + 4 + offset); expect(p.playerLocation).toBe('START'); }
  }, 180_000);
});
